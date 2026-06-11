"""
Stitch ATS — File Parser Service
Extracts text from PDF and DOCX files.
"""

import io
import re


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from a PDF file."""
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(io.BytesIO(file_bytes))
        text_parts = []
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
        return "\n".join(text_parts).strip()
    except Exception as e:
        return f"[Error extracting PDF: {str(e)}]"


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract text from a DOCX file."""
    try:
        from docx import Document
        doc = Document(io.BytesIO(file_bytes))
        text_parts = []
        for para in doc.paragraphs:
            if para.text.strip():
                text_parts.append(para.text.strip())
        return "\n".join(text_parts).strip()
    except Exception as e:
        return f"[Error extracting DOCX: {str(e)}]"


def extract_text(filename: str, file_bytes: bytes) -> str:
    """Route to the correct extractor based on file extension."""
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext == "pdf":
        return extract_text_from_pdf(file_bytes)
    elif ext in ("docx", "doc"):
        return extract_text_from_docx(file_bytes)
    elif ext == "txt":
        return file_bytes.decode("utf-8", errors="ignore").strip()
    else:
        return file_bytes.decode("utf-8", errors="ignore").strip()


def extract_candidate_name(text: str, filename: str) -> str:
    """Try to extract a candidate name from resume text or filename."""
    # Try first non-empty line as name (common resume format)
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    if lines:
        first_line = lines[0]
        # Check if first line looks like a name (2-4 words, no special chars)
        words = first_line.split()
        if 1 <= len(words) <= 4 and all(w.isalpha() for w in words):
            return first_line

    # Fall back to filename
    name = filename.rsplit(".", 1)[0]
    name = re.sub(r"[_\-]", " ", name)
    name = re.sub(r"(resume|cv|candidate)", "", name, flags=re.IGNORECASE).strip()
    return name.title() if name else "Unknown Candidate"


def extract_email(text: str) -> str | None:
    """Try to extract an email from text."""
    match = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", text)
    return match.group(0) if match else None


def extract_phone(text: str) -> str | None:
    """Try to extract a phone number from text."""
    match = re.search(r"[\+]?[(]?[0-9]{1,4}[)]?[-\s\./0-9]{7,15}", text)
    return match.group(0).strip() if match else None
