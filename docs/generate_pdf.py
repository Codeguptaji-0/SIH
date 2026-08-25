import os
import re
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

def generate_pdf():
    md_file = os.path.join(os.path.dirname(__file__), "master_project_and_testing_documentation.md")
    pdf_file = os.path.join(os.path.dirname(__file__), "SkillSetu_Master_Documentation_and_Testing_Manual.pdf")

    if not os.path.exists(md_file):
        print(f"Error: {md_file} not found.")
        return

    with open(md_file, "r", encoding="utf-8") as f:
        md_text = f.read()

    doc = SimpleDocTemplate(
        pdf_file,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=10
    )

    h1_style = ParagraphStyle(
        'DocH1',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#1e3a8a'),
        spaceBefore=14,
        spaceAfter=8
    )

    h2_style = ParagraphStyle(
        'DocH2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor('#1d4ed8'),
        spaceBefore=10,
        spaceAfter=6
    )

    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155'),
        spaceAfter=6
    )

    code_style = ParagraphStyle(
        'DocCode',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor('#0f172a'),
        backColor=colors.HexColor('#f1f5f9'),
        borderPadding=4,
        spaceBefore=4,
        spaceAfter=6
    )

    story = []

    # Title & Header
    story.append(Paragraph("SkillSetu — Master Architecture, Workflow & Testing Manual", title_style))
    story.append(Paragraph("<b>Smart India Hackathon 2026</b> • Problem Statement SIH26101 (MoSPI DIID)", body_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#1e3a8a'), spaceBefore=8, spaceAfter=12))

    lines = md_text.split("\n")
    in_code_block = False
    code_lines = []
    in_table = False
    table_data = []

    def flush_code_block():
        nonlocal code_lines
        if code_lines:
            code_text = "<br/>".join([c.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace(" ", "&nbsp;") for c in code_lines])
            story.append(Paragraph(code_text, code_style))
            code_lines = []

    def flush_table():
        nonlocal table_data, in_table
        if table_data:
            # Build Table Flowable
            formatted_data = []
            for row in table_data:
                formatted_row = [Paragraph(cell.strip(), body_style) for cell in row]
                formatted_data.append(formatted_row)
            
            t = Table(formatted_data, colWidths=None)
            t.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e0edff')),
                ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#1e3a8a')),
                ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
                ('TOPPADDING', (0,0), (-1,-1), 4),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ]))
            story.append(t)
            story.append(Spacer(1, 8))
            table_data = []
            in_table = False

    for line in lines:
        line_str = line.rstrip()

        # Code block handling
        if line_str.startswith("```"):
            if in_code_block:
                in_code_block = False
                flush_code_block()
            else:
                in_code_block = True
                flush_table()
            continue

        if in_code_block:
            code_lines.append(line_str)
            continue

        # Table handling
        if "|" in line_str and not line_str.startswith("```"):
            parts = [p.strip() for p in line_str.split("|")[1:-1]]
            if parts and not all(set(p).issubset({'-', ':', ' '}) for p in parts):
                table_data.append(parts)
                in_table = True
                continue
            elif all(set(p).issubset({'-', ':', ' '}) for p in parts):
                continue

        if in_table and ("|" not in line_str or line_str.strip() == ""):
            flush_table()

        if line_str.strip() == "":
            story.append(Spacer(1, 4))
            continue

        # Headers
        if line_str.startswith("# "):
            story.append(Paragraph(line_str[2:].strip(), title_style))
        elif line_str.startswith("## "):
            story.append(Paragraph(line_str[3:].strip(), h1_style))
        elif line_str.startswith("### "):
            story.append(Paragraph(line_str[4:].strip(), h2_style))
        elif line_str.startswith("#### "):
            story.append(Paragraph(f"<b>{line_str[5:].strip()}</b>", body_style))
        elif line_str.startswith("* ") or line_str.startswith("- "):
            bullet_text = line_str[2:].strip()
            # Clean bold syntax
            bullet_text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', bullet_text)
            bullet_text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', bullet_text)
            story.append(Paragraph(f"• {bullet_text}", body_style))
        else:
            text = line_str.strip()
            text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
            text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', text)
            story.append(Paragraph(text, body_style))

    if in_table:
        flush_table()
    if in_code_block:
        flush_code_block()

    doc.build(story)
    print(f"[OK] PDF generated successfully: {pdf_file}")

if __name__ == "__main__":
    generate_pdf()
