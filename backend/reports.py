import io
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_pdf_report_bytes(report_data):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=16,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=10
    )
    heading_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        textColor=colors.HexColor('#1e293b'),
        spaceBefore=12,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        textColor=colors.HexColor('#334155'),
        spaceAfter=4
    )
    mono_style = ParagraphStyle(
        'MonoText',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        textColor=colors.HexColor('#0f172a')
    )

    story = []

    # Title & Header
    story.append(Paragraph(f"<b>EVIDENCELOCK</b> — Forensic Integrity Verification Certificate", title_style))
    story.append(Paragraph(f"<b>Certificate Number:</b> {report_data.get('report_number')}", body_style))
    story.append(Paragraph(f"<b>Generated:</b> {report_data.get('timestamp')} UTC", body_style))
    story.append(Spacer(1, 10))

    # Section 1: Docket & File Metadata
    story.append(Paragraph("1. DOCKET & EVIDENCE METADATA", heading_style))
    meta_table_data = [
        ["Evidence Item ID:", report_data.get('item_number'), "Case Docket:", report_data.get('case_number')],
        ["Original Filename:", report_data.get('original_filename'), "Evidence Classification:", report_data.get('evidence_type')],
        ["File Size (Bytes):", str(report_data.get('file_size_bytes')), "Current Custodian:", report_data.get('current_custodian')],
    ]
    t1 = Table(meta_table_data, colWidths=[120, 160, 120, 140])
    t1.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('TEXTCOLOR', (0,0), (-1,-1), colors.HexColor('#1e293b')),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t1)
    story.append(Spacer(1, 10))

    # Section 2: Cryptographic Hash Verification
    story.append(Paragraph("2. CRYPTOGRAPHIC BITSTREAM AUDIT (SHA-256)", heading_style))
    story.append(Paragraph(f"<b>Integrity Audit Status:</b> {report_data.get('overall_status')}", body_style))
    story.append(Paragraph(f"<b>Trusted Genesis Hash:</b> <font face='Courier'>{report_data.get('trusted_sha256')}</font>", body_style))
    story.append(Paragraph(f"<b>Current Calculated Hash:</b> <font face='Courier'>{report_data.get('calculated_sha256')}</font>", body_style))
    story.append(Spacer(1, 10))

    # Section 3: Checkpoint & Custody
    story.append(Paragraph("3. ASYMMETRIC DIGITAL CHECKPOINT & MERKLE CHAIN", heading_style))
    story.append(Paragraph(f"<b>Merkle Chain Head Sequence:</b> #{report_data.get('chain_head_sequence')}", body_style))
    story.append(Paragraph(f"<b>Anchored Checkpoint Hash:</b> <font face='Courier'>{report_data.get('chain_head_hash')}</font>", body_style))
    story.append(Paragraph(f"<b>Asymmetric Algorithm:</b> ECDSA-SHA256 (NIST P-256 / secp256r1)", body_style))
    story.append(Paragraph(f"<b>Key Identifier:</b> {report_data.get('key_id')}", body_style))
    story.append(Spacer(1, 10))

    # Section 4: Mandatory Legal Disclaimer
    story.append(Paragraph("4. FINDINGS & EVIDENTIARY DISCLAIMER", heading_style))
    story.append(Paragraph(report_data.get('findings', 'Zero bitstream deviations detected.'), body_style))
    disclaimer_text = (
        "<b>MANDATORY FORENSIC DISCLAIMER:</b><br/>"
        "1. A matching SHA-256 checksum proves that the stored file bytes have not altered since the moment of intake into EvidenceLock.<br/>"
        "2. It does NOT prove that the original evidence was genuine or authentic prior to acquisition.<br/>"
        "3. A hash mismatch proves an alteration occurred, but does not identify motive or determine malicious intent.<br/>"
        "4. Legal admissibility remains subject to court evidentiary rules and qualified expert testimony."
    )
    story.append(Spacer(1, 6))
    story.append(Paragraph(disclaimer_text, body_style))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
