"""Sends the weekly emails: the drafts to the reviewers, or an error report.

Uses only Python's standard library, so it runs with plain `python3` (no
virtual environment needed), and a Gmail app password set in .env (see README).

Usage: python3 -m agents.mail drafts                  (newest batch)
       python3 -m agents.mail drafts posts/2026-10-19
       python3 -m agents.mail error --step "generating posts" --message "what went wrong" [--log run.log]
       python3 -m agents.mail check                   (checks the settings are complete, sends nothing)
       python3 -m agents.mail test                    (sends a short test email)
       Add --dry-run to save the email as a .eml file instead of sending it.

Exit codes: 0 sent, 1 sending failed, 2 settings missing or nothing to send.
"""

from __future__ import annotations

import argparse
import mimetypes
import os
import smtplib
import ssl
import sys
from datetime import datetime
from email.message import EmailMessage
from html import escape
from pathlib import Path

from .batch import ROOT, list_batches, read_batch

EMAIL_LIMIT_MB = 24  # Gmail refuses attachments over 25 MB


class MailError(Exception):
    """A setup problem, explained in plain words."""


def load_env_file() -> None:
    """Reads .env into the environment without overriding what's already set."""
    file = ROOT / ".env"
    if not file.exists():
        return
    for line in file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def settings() -> dict:
    sender = os.environ.get("MAIL_FROM", "").strip()
    password = os.environ.get("MAIL_APP_PASSWORD", "").replace(" ", "")
    to = [a.strip() for a in os.environ.get("MAIL_TO", "").split(",") if a.strip()]
    errors_to = [a.strip() for a in os.environ.get("MAIL_ERRORS_TO", "").split(",") if a.strip()] or [sender]
    if not sender or not password:
        raise MailError("Set MAIL_FROM and MAIL_APP_PASSWORD in .env to send email (see README).")
    return {
        "from": sender,
        "password": password,
        "to": to,
        "errors_to": errors_to,
        "host": os.environ.get("MAIL_SMTP_HOST", "smtp.gmail.com"),
        "port": int(os.environ.get("MAIL_SMTP_PORT", "465")),
    }


def send(message: EmailMessage, config: dict, dry_run_path: Path | None = None) -> None:
    if dry_run_path:
        dry_run_path.write_bytes(bytes(message))
        print(f"Dry run: saved the email as {dry_run_path.relative_to(ROOT) if dry_run_path.is_relative_to(ROOT) else dry_run_path}")
        return
    # Port 465 is encrypted from the start; other ports switch to encryption
    # (STARTTLS) when the server offers it.
    if config["port"] == 465:
        server = smtplib.SMTP_SSL(config["host"], config["port"], context=ssl.create_default_context(), timeout=60)
    else:
        server = smtplib.SMTP(config["host"], config["port"], timeout=60)
    with server:
        server.ehlo()
        if config["port"] != 465 and server.has_extn("starttls"):
            server.starttls(context=ssl.create_default_context())
            server.ehlo()
        # Always log in: the settings require a password.
        server.login(config["from"], config["password"])
        server.send_message(message)
    print(f"Sent \"{message['Subject']}\" to {message['To']}.")


def new_message(config: dict, to: list[str], subject: str, text: str, html: str) -> EmailMessage:
    message = EmailMessage()
    message["From"] = config["from"]
    message["To"] = ", ".join(to)
    message["Subject"] = subject
    message.set_content(text)
    message.add_alternative(html, subtype="html")
    return message


def attach(message: EmailMessage, file: Path) -> None:
    kind = (mimetypes.guess_type(file.name)[0] or "application/octet-stream").split("/")
    message.add_attachment(file.read_bytes(), maintype=kind[0], subtype=kind[1], filename=file.name)


def batch_folder(arg: str | None) -> Path:
    if arg:
        return Path(arg).resolve()
    batches = list_batches()
    if not batches:
        raise MailError("There are no batches in posts/ yet.")
    return batches[-1]


def drafts_email(folder: Path, config: dict) -> EmailMessage:
    if not config["to"]:
        raise MailError("Set MAIL_TO in .env: who gets the weekly drafts (comma-separated).")
    name = folder.name
    pdf = folder / f"forethrive-drafts-{name}.pdf"
    page = folder / f"forethrive-drafts-{name}.html"
    if not pdf.exists() or not page.exists():
        raise MailError(f"Export the drafts first: npm run export -- {folder} --drafts")
    posts = [p for p in read_batch(folder)["posts"] if p.get("status") != "skipped"]

    subject = f"LinkedIn drafts for the week of {name}: {len(posts)} posts to review"
    intro = (
        f"This week's {len(posts)} LinkedIn drafts for the Forethrive page are attached.\n\n"
        f"- {pdf.name}: read them, one post per page.\n"
        f"- {page.name}: open in a browser to copy captions and download images.\n\n"
        "Pick the ones worth posting and pass them to whoever posts on LinkedIn."
    )
    listing = "\n".join(f"{p['id']}  {p['type']}: {p['image']['headline']}" for p in posts)
    text = f"{intro}\n\n{listing}\n\nMade automatically by the Forethrive post orchestrator."
    rows = "".join(
        f"<tr><td style='padding:4px 12px 4px 0;color:#5b6384'>{escape(p['id'])}</td>"
        f"<td style='padding:4px 12px 4px 0;color:#5b6384'>{escape(p['type'])}</td>"
        f"<td style='padding:4px 0'>{escape(p['image']['headline'])}</td></tr>"
        for p in posts
    )
    html = (
        "<div style='font-family:Arial,sans-serif;font-size:15px;color:#03061a;line-height:1.5'>"
        f"<p>This week's <b>{len(posts)}</b> LinkedIn drafts for the Forethrive page are attached.</p>"
        f"<ul><li><b>{escape(pdf.name)}</b>: read them, one post per page.</li>"
        f"<li><b>{escape(page.name)}</b>: open in a browser to copy captions and download images.</li></ul>"
        "<p>Pick the ones worth posting and pass them to whoever posts on LinkedIn.</p>"
        f"<table style='border-collapse:collapse;margin:12px 0'>{rows}</table>"
        "<p style='color:#5b6384;font-size:13px'>Made automatically by the Forethrive post orchestrator.</p></div>"
    )
    message = new_message(config, config["to"], subject, text, html)
    attach(message, pdf)
    if (pdf.stat().st_size + page.stat().st_size) / 1024 / 1024 < EMAIL_LIMIT_MB:
        attach(message, page)
    return message


def error_email(config: dict, step: str, detail: str, log: Path | None) -> EmailMessage:
    when = datetime.now().strftime("%A %d %B %Y, %H:%M")
    tail = ""
    if log and log.exists():
        tail = "\n".join(log.read_text(errors="replace").splitlines()[-60:])
    text = (
        f"The weekly LinkedIn drafts could not be made ({when}).\n\n"
        f"Step that failed: {step}\nWhat happened: {detail}\n\n"
        + (f"Last lines of the log:\n{tail}\n\n" if tail else "")
        + "To try again: open the Claude app, go to Scheduled, and press Run now on the weekly drafts task. "
        "Or open the post-orchestrator folder in Claude Code and type /generate-posts."
    )
    html = (
        "<div style='font-family:Arial,sans-serif;font-size:15px;color:#03061a;line-height:1.5'>"
        f"<p>The weekly LinkedIn drafts could not be made ({escape(when)}).</p>"
        f"<p><b>Step that failed:</b> {escape(step)}<br><b>What happened:</b> {escape(detail)}</p>"
        + (f"<p><b>Last lines of the log:</b></p><pre style='background:#f6f7fc;padding:12px;white-space:pre-wrap'>{escape(tail)}</pre>" if tail else "")
        + "<p>To try again: open the Claude app, go to Scheduled, and press <b>Run now</b> on the weekly drafts task. "
        "Or open the post-orchestrator folder in Claude Code and type <code>/generate-posts</code>.</p></div>"
    )
    return new_message(config, config["errors_to"], f"LinkedIn drafts failed this week: {step}", text, html)


def main() -> int:
    parser = argparse.ArgumentParser(prog="python3 -m agents.mail", description="Send the weekly drafts or an error report.")
    sub = parser.add_subparsers(dest="command", required=True)
    drafts = sub.add_parser("drafts", help="email this week's drafts to MAIL_TO")
    drafts.add_argument("folder", nargs="?", help="the batch folder (default: the newest)")
    error = sub.add_parser("error", help="email an error report to MAIL_ERRORS_TO")
    error.add_argument("--step", required=True, help="which step failed")
    error.add_argument("--message", required=True, help="what went wrong, in a sentence")
    error.add_argument("--log", help="a log file whose last lines are included")
    sub.add_parser("check", help="check the email settings are complete, without sending")
    sub.add_parser("test", help="send a short test email to MAIL_ERRORS_TO")
    for command in (drafts, error, sub.choices["test"]):
        command.add_argument("--dry-run", action="store_true", help="save the email as a .eml file instead of sending")
    args = parser.parse_args()

    load_env_file()
    try:
        config = settings()
        if args.command == "check":
            if not config["to"]:
                raise MailError("Set MAIL_TO in .env: who gets the weekly drafts (comma-separated).")
            print(f"Email settings look complete: drafts go from {config['from']} to {', '.join(config['to'])}; "
                  f"errors go to {', '.join(config['errors_to'])}.")
            return 0
        if args.command == "drafts":
            folder = batch_folder(args.folder)
            message = drafts_email(folder, config)
            dry = folder / f"drafts-email-{folder.name}.eml"
        elif args.command == "error":
            message = error_email(config, args.step, args.message, Path(args.log) if args.log else None)
            dry = ROOT / "posts" / "error-email.eml"
        else:
            message = new_message(
                config, config["errors_to"], "Test from the Forethrive post orchestrator",
                "Email settings work. The weekly drafts will arrive from this address.",
                "<p>Email settings work. The weekly drafts will arrive from this address.</p>",
            )
            dry = ROOT / "posts" / "test-email.eml"
        if args.dry_run:
            dry.parent.mkdir(parents=True, exist_ok=True)
        send(message, config, dry if args.dry_run else None)
        return 0
    except MailError as problem:
        print(problem, file=sys.stderr)
        return 2
    except (smtplib.SMTPException, OSError) as problem:
        print(f"Could not send the email: {problem}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
