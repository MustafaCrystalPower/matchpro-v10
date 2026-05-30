#!/usr/bin/env python3
"""MatchPro™ Investor Package — Full Professional PDF"""

import os
import math
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import inch, cm, mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.platypus.flowables import Flowable
from reportlab.pdfgen import canvas as pdfcanvas

# ─── COLORS ───────────────────────────────────────────────────────────────────
NAVY      = colors.HexColor('#0B2545')
GOLD      = colors.HexColor('#C9A961')
WHITE     = colors.white
LIGHT_BG  = colors.HexColor('#F4F6F9')
GOLD_TINT = colors.HexColor('#FFFBF0')
RED_TINT  = colors.HexColor('#FEF2F2')
RED_ACC   = colors.HexColor('#DC2626')
GREY_TEXT = colors.HexColor('#444444')
MID_GREY  = colors.HexColor('#888888')
DARK_GOLD = colors.HexColor('#A88230')

# ─── PAGE SETUP ───────────────────────────────────────────────────────────────
PAGE_W, PAGE_H = A4
MARGIN = 50
CONTENT_W = PAGE_W - 2 * MARGIN
OUT_PATH = '/home/work/.openclaw/workspace/matchpro/MatchPro_Investor_Package_FULL.pdf'

# ─── WATERMARK ────────────────────────────────────────────────────────────────
def draw_watermark(c):
    c.saveState()
    c.setFont('Helvetica-Bold', 52)
    c.setFillColorRGB(0.85, 0.85, 0.85, alpha=0.10)
    c.translate(PAGE_W / 2, PAGE_H / 2)
    c.rotate(45)
    c.drawCentredString(0, 0, 'CONFIDENTIAL')
    c.restoreState()

def draw_footer(c, page_num):
    c.saveState()
    c.setFont('Helvetica', 7)
    c.setFillColor(MID_GREY)
    footer = 'Confidential — Crystal Power Investments © 2026 | MatchPro™ Investor Package'
    c.drawCentredString(PAGE_W / 2, 22, footer)
    c.setFont('Helvetica', 8)
    c.drawCentredString(PAGE_W / 2, 11, str(page_num))
    c.restoreState()

def draw_cover(c, doc):
    """Draw full navy cover page."""
    c.saveState()
    # Navy background
    c.setFillColor(NAVY)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.restoreState()
    draw_watermark(c)

    cx = PAGE_W / 2
    # Company name
    c.setFillColor(GOLD)
    c.setFont('Helvetica', 10)
    c.drawCentredString(cx, PAGE_H - 68, 'C R Y S T A L   P O W E R   I N V E S T M E N T S')
    # Top gold rule
    c.setStrokeColor(GOLD)
    c.setLineWidth(1)
    c.line(MARGIN, PAGE_H - 84, PAGE_W - MARGIN, PAGE_H - 84)

    # Main title
    c.setFillColor(GOLD)
    c.setFont('Helvetica-Bold', 56)
    c.drawCentredString(cx, PAGE_H / 2 + 72, 'MatchPro\u2122')

    # Thin gold rule below title
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.5)
    rule_x1 = cx - 120
    rule_x2 = cx + 120
    c.line(rule_x1, PAGE_H / 2 + 54, rule_x2, PAGE_H / 2 + 54)

    # English tagline
    c.setFillColor(WHITE)
    c.setFont('Helvetica', 17)
    c.drawCentredString(cx, PAGE_H / 2 + 28, "The Intelligence Layer for Egypt's Real Estate Market")

    # Arabic tagline
    c.setFont('Helvetica-Oblique', 12)
    c.setFillColor(GOLD)
    c.drawCentredString(cx, PAGE_H / 2 + 6, '\u0637\u0628\u0642\u0629 \u0627\u0644\u0630\u0643\u0627\u0621 \u0644\u0633\u0648\u0642 \u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062a \u0627\u0644\u0645\u0635\u0631\u064a')

    # Spacer line
    c.setStrokeColor(colors.HexColor('#334466'))
    c.setLineWidth(0.5)
    c.line(MARGIN, PAGE_H / 2 - 12, PAGE_W - MARGIN, PAGE_H / 2 - 12)

    # Briefing label
    c.setFillColor(WHITE)
    c.setFont('Helvetica', 12)
    c.drawCentredString(cx, PAGE_H / 2 - 36, 'Investor Briefing \u2014 Proof of Concept & Commercial Case')

    # Date / confidential
    c.setFont('Helvetica', 9)
    c.setFillColor(colors.HexColor('#AAAAAA'))
    c.drawCentredString(cx, PAGE_H / 2 - 56, 'May 2026  |  Confidential \u2014 Not for Distribution')

    # Bottom gold rule
    c.setStrokeColor(GOLD)
    c.setLineWidth(1)
    c.line(MARGIN, MARGIN + 34, PAGE_W - MARGIN, MARGIN + 34)

    # Footer
    c.setFillColor(WHITE)
    c.setFont('Helvetica', 9)
    c.drawCentredString(cx, MARGIN + 14, 'Crystal Power Investments  |  Cairo, Egypt')


def on_first_page(c, doc):
    draw_cover(c, doc)

def on_later_pages(c, doc):
    draw_watermark(c)
    draw_footer(c, doc.page)


# ─── STYLES ───────────────────────────────────────────────────────────────────
def make_styles():
    S = {}
    S['body'] = ParagraphStyle('body', fontName='Helvetica', fontSize=9.5,
        leading=15, textColor=GREY_TEXT, spaceAfter=5, spaceBefore=2, alignment=TA_JUSTIFY)
    S['body_left'] = ParagraphStyle('body_left', fontName='Helvetica', fontSize=9.5,
        leading=15, textColor=GREY_TEXT, spaceAfter=5, spaceBefore=2)
    S['h2'] = ParagraphStyle('h2', fontName='Helvetica-Bold', fontSize=13,
        leading=18, textColor=NAVY, spaceBefore=14, spaceAfter=8)
    S['h3'] = ParagraphStyle('h3', fontName='Helvetica-Bold', fontSize=11,
        leading=15, textColor=NAVY, spaceBefore=10, spaceAfter=4)
    S['gold_label'] = ParagraphStyle('gold_label', fontName='Helvetica-Bold', fontSize=10,
        textColor=GOLD, leading=14, spaceBefore=4, spaceAfter=2)
    S['small'] = ParagraphStyle('small', fontName='Helvetica', fontSize=8,
        leading=12, textColor=GREY_TEXT)
    S['center'] = ParagraphStyle('center', fontName='Helvetica', fontSize=9,
        leading=13, textColor=GREY_TEXT, alignment=TA_CENTER)
    S['arabic'] = ParagraphStyle('arabic', fontName='Helvetica-Oblique', fontSize=9,
        leading=14, textColor=DARK_GOLD, alignment=TA_CENTER)
    S['disclaimer'] = ParagraphStyle('disclaimer', fontName='Helvetica', fontSize=8.5,
        leading=14, textColor=GREY_TEXT, alignment=TA_JUSTIFY, spaceAfter=6)
    S['nav_white'] = ParagraphStyle('nav_white', fontName='Helvetica', fontSize=9,
        leading=14, textColor=WHITE)
    return S


# ─── CUSTOM FLOWABLES ─────────────────────────────────────────────────────────

class SectionHeader(Flowable):
    def __init__(self, title, subtitle=None, width=None):
        super().__init__()
        self.title = title
        self.subtitle = subtitle
        self._w = width or CONTENT_W

    def wrap(self, *args):
        return self._w, 52 if self.subtitle else 40

    def draw(self):
        c = self.canv
        w = self._w
        h = 52 if self.subtitle else 40
        c.setFillColor(NAVY)
        c.roundRect(0, 0, w, h, 4, fill=1, stroke=0)
        c.setFillColor(GOLD)
        c.rect(0, 0, 5, h, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 15)
        ty = h - 25 if self.subtitle else h / 2 - 6
        c.drawString(14, ty, self.title)
        if self.subtitle:
            c.setFillColor(GOLD)
            c.setFont('Helvetica', 8)
            # wrap subtitle
            words = self.subtitle.split()
            line, y = '', 10
            lines = []
            for w2 in words:
                test = (line + ' ' + w2).strip()
                if c.stringWidth(test, 'Helvetica', 8) <= self._w - 28:
                    line = test
                else:
                    lines.append(line); line = w2
            if line: lines.append(line)
            for i, ln in enumerate(reversed(lines)):
                c.drawString(14, y + i * 11, ln)


class PainBox(Flowable):
    def __init__(self, title, body, w=None, h=90):
        super().__init__()
        self.title = title
        self.body = body
        self._w = w or CONTENT_W
        self._h = h

    def wrap(self, *args):
        return self._w, self._h

    def _wrap_text(self, c, text, font, size, x, y, max_w, line_h):
        words = text.split()
        line, lines = '', []
        for word in words:
            test = (line + ' ' + word).strip()
            if c.stringWidth(test, font, size) <= max_w:
                line = test
            else:
                if line: lines.append(line)
                line = word
        if line: lines.append(line)
        for i, ln in enumerate(lines):
            c.drawString(x, y - i * line_h, ln)

    def draw(self):
        c = self.canv
        w, h = self._w, self._h
        c.setFillColor(RED_TINT)
        c.roundRect(0, 0, w, h, 4, fill=1, stroke=0)
        c.setFillColor(RED_ACC)
        c.rect(0, 0, 4, h, fill=1, stroke=0)
        c.setFillColor(RED_ACC)
        c.setFont('Helvetica-Bold', 10)
        c.drawString(14, h - 20, self.title)
        c.setFillColor(GREY_TEXT)
        c.setFont('Helvetica', 8.5)
        self._wrap_text(c, self.body, 'Helvetica', 8.5, 14, h - 34, w - 26, 13)


class FeatureBox(Flowable):
    def __init__(self, icon, title, body, w=None, h=105):
        super().__init__()
        self.icon = icon
        self.title = title
        self.body = body
        self._w = w or CONTENT_W
        self._h = h

    def wrap(self, *args):
        return self._w, self._h

    def _wrap_text(self, c, text, font, size, x, y, max_w, line_h):
        words = text.split()
        line, lines = '', []
        for word in words:
            test = (line + ' ' + word).strip()
            if c.stringWidth(test, font, size) <= max_w:
                line = test
            else:
                if line: lines.append(line)
                line = word
        if line: lines.append(line)
        for i, ln in enumerate(lines):
            c.drawString(x, y - i * line_h, ln)

    def draw(self):
        c = self.canv
        w, h = self._w, self._h
        c.setFillColor(NAVY)
        c.roundRect(0, 0, w, h, 6, fill=1, stroke=0)
        c.setFillColor(GOLD)
        c.roundRect(0, 0, 52, h, 6, fill=1, stroke=0)
        c.setFillColor(GOLD)
        c.rect(8, 0, 44, h, fill=1, stroke=0)
        c.setFillColor(NAVY)
        c.setFont('Helvetica-Bold', 20)
        c.drawCentredString(26, h / 2 - 10, self.icon)
        c.setFillColor(GOLD)
        c.setFont('Helvetica-Bold', 11)
        c.drawString(62, h - 24, self.title)
        c.setFillColor(WHITE)
        c.setFont('Helvetica', 8.5)
        self._wrap_text(c, self.body, 'Helvetica', 8.5, 62, h - 40, w - 72, 13)


class StatBox(Flowable):
    def __init__(self, number, label, w=None, h=90):
        super().__init__()
        self.number = number
        self.label = label
        self._w = w or 120
        self._h = h

    def wrap(self, *args):
        return self._w, self._h

    def draw(self):
        c = self.canv
        w, h = self._w, self._h
        c.setStrokeColor(NAVY)
        c.setFillColor(WHITE)
        c.setLineWidth(1.5)
        c.roundRect(0, 0, w, h, 6, fill=1, stroke=1)
        c.setFillColor(GOLD)
        c.setFont('Helvetica-Bold', 20)
        c.drawCentredString(w / 2, h - 34, self.number)
        c.setFillColor(NAVY)
        c.setFont('Helvetica', 7.5)
        words = self.label.split()
        lines = []
        line = ''
        for word in words:
            test = (line + ' ' + word).strip()
            if c.stringWidth(test, 'Helvetica', 7.5) <= w - 8:
                line = test
            else:
                if line: lines.append(line)
                line = word
        if line: lines.append(line)
        start_y = h - 48
        for i, ln in enumerate(lines[:3]):
            c.drawCentredString(w / 2, start_y - i * 11, ln)


class HighlightBox(Flowable):
    def __init__(self, text, arabic=None, w=None, h=80):
        super().__init__()
        self.text = text
        self.arabic = arabic
        self._w = w or CONTENT_W
        self._h = h

    def wrap(self, *args):
        return self._w, self._h

    def _wrap_text(self, c, text, font, size, x, y, max_w, line_h):
        words = text.split()
        line, lines = '', []
        for word in words:
            test = (line + ' ' + word).strip()
            if c.stringWidth(test, font, size) <= max_w:
                line = test
            else:
                if line: lines.append(line)
                line = word
        if line: lines.append(line)
        for i, ln in enumerate(lines):
            c.drawString(x, y - i * line_h, ln)

    def draw(self):
        c = self.canv
        w, h = self._w, self._h
        c.setFillColor(GOLD_TINT)
        c.roundRect(0, 0, w, h, 6, fill=1, stroke=0)
        c.setStrokeColor(GOLD)
        c.setLineWidth(2)
        c.roundRect(0, 0, w, h, 6, fill=0, stroke=1)
        c.setFillColor(GOLD)
        c.rect(0, 0, 4, h, fill=1, stroke=0)
        c.setFillColor(NAVY)
        c.setFont('Helvetica-Bold', 9)
        self._wrap_text(c, self.text, 'Helvetica-Bold', 9, 14, h - 16, w - 22, 13)
        if self.arabic:
            c.setFont('Helvetica-Oblique', 8)
            c.setFillColor(DARK_GOLD)
            c.drawString(14, 12, self.arabic)


class VerdictBox(Flowable):
    def __init__(self, text, arabic=None, w=None, h=90):
        super().__init__()
        self.text = text
        self.arabic = arabic
        self._w = w or CONTENT_W
        self._h = h

    def wrap(self, *args):
        return self._w, self._h

    def _wrap_text(self, c, text, font, size, x, y, max_w, line_h):
        words = text.split()
        line, lines = '', []
        for word in words:
            test = (line + ' ' + word).strip()
            if c.stringWidth(test, font, size) <= max_w:
                line = test
            else:
                if line: lines.append(line)
                line = word
        if line: lines.append(line)
        for i, ln in enumerate(lines):
            c.drawString(x, y - i * line_h, ln)

    def draw(self):
        c = self.canv
        w, h = self._w, self._h
        c.setFillColor(GOLD)
        c.roundRect(0, 0, w, h, 6, fill=1, stroke=0)
        c.setFillColor(NAVY)
        c.setFont('Helvetica-Bold', 9)
        self._wrap_text(c, self.text, 'Helvetica-Bold', 9, 14, h - 16, w - 22, 13)
        if self.arabic:
            c.setFont('Helvetica-Oblique', 8)
            c.setFillColor(NAVY)
            c.drawString(14, 12, self.arabic)


class ContactBox(Flowable):
    def __init__(self, w=None, h=110):
        super().__init__()
        self._w = w or CONTENT_W
        self._h = h

    def wrap(self, *args):
        return self._w, self._h

    def draw(self):
        c = self.canv
        w, h = self._w, self._h
        # Gold top bar
        c.setFillColor(GOLD)
        c.roundRect(0, h - 44, w, 44, 8, fill=1, stroke=0)
        c.rect(0, h - 44, w, 22, fill=1, stroke=0)  # flatten bottom corners
        # White body
        c.setFillColor(WHITE)
        c.roundRect(0, 0, w, h - 22, 8, fill=1, stroke=0)
        c.setStrokeColor(GOLD)
        c.setLineWidth(2)
        c.roundRect(0, 0, w, h, 8, fill=0, stroke=1)
        # Name in gold bar
        c.setFillColor(NAVY)
        c.setFont('Helvetica-Bold', 13)
        c.drawCentredString(w / 2, h - 28, "Mo'men Maisara — Founder & CEO")
        # Contact details
        c.setFillColor(NAVY)
        c.setFont('Helvetica', 10)
        c.drawCentredString(w / 2, h - 58, 'maisaramoamen@outlook.com')
        c.drawCentredString(w / 2, h - 74, '+20 106 650 5665')
        c.drawCentredString(w / 2, h - 90, 'Crystal Power Investments, Cairo, Egypt')


class AskBox(Flowable):
    def __init__(self, w=None, h=72):
        super().__init__()
        self._w = w or CONTENT_W
        self._h = h

    def wrap(self, *args):
        return self._w, self._h

    def draw(self):
        c = self.canv
        w, h = self._w, self._h
        c.setFillColor(NAVY)
        c.setStrokeColor(GOLD)
        c.setLineWidth(2.5)
        c.roundRect(0, 0, w, h, 8, fill=1, stroke=1)
        c.setFillColor(GOLD)
        c.setFont('Helvetica-Bold', 22)
        c.drawCentredString(w / 2, h - 34, 'Seeking: $250,000 \u2013 $2,000,000 USD')
        c.setFillColor(WHITE)
        c.setFont('Helvetica', 11)
        c.drawCentredString(w / 2, h - 54, 'Use of Funds  |  \u062a\u0648\u0638\u064a\u0641 \u0627\u0644\u0623\u0645\u0648\u0627\u0644')


# ─── TABLE STYLE ──────────────────────────────────────────────────────────────
def std_ts():
    return TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8.5),
        ('TEXTCOLOR', (0, 1), (-1, -1), NAVY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_BG]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('LINEBELOW', (0, 0), (-1, 0), 1.5, GOLD),
    ])


# ─── BUILD ────────────────────────────────────────────────────────────────────
def build():
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    doc = SimpleDocTemplate(
        OUT_PATH, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN, bottomMargin=MARGIN + 20,
        title='MatchPro™ Investor Package',
        author='Crystal Power Investments',
        subject='Seed/Angel/VC Investor Briefing',
    )
    S = make_styles()
    story = []

    # ── PAGE 1: COVER (drawn entirely via on_first_page canvas callback) ────────
    # Use a tiny spacer + PageBreak so the cover page is just the canvas artwork.
    story.append(Spacer(1, 1))
    story.append(PageBreak())

    # ── PAGE 2: THE PROBLEM ────────────────────────────────────────────────────
    story.append(SectionHeader('The Problem',
        "Egypt's real estate market has $97.5B in annual transaction volume — and almost no data infrastructure."))
    story.append(Spacer(1, 12))

    for title, body in [
        ('Pain Point 1: Brokers Work in Silos',
         '50,000+ brokers in Greater Cairo operate across 200+ WhatsApp groups. A buyer in one group never sees a matching seller in another. Deals die because the right two people never meet.'),
        ('Pain Point 2: No Real-Time Market Intelligence',
         'There is no live feed of buyer demand or seller supply in Egypt. Developers, investors, and brokers make decisions based on intuition, not data. Price discovery is broken.'),
        ('Pain Point 3: Manual Matching Is Impossible at Scale',
         'A human broker can monitor 5–10 groups. MatchPro™ monitors 50+. The volume of daily messages (200–500/day) makes manual cross-referencing economically unviable.'),
    ]:
        story.append(PainBox(title, body, w=CONTENT_W, h=88))
        story.append(Spacer(1, 10))

    story.append(PageBreak())

    # ── PAGE 3: THE SOLUTION ───────────────────────────────────────────────────
    story.append(SectionHeader('MatchPro™ — What It Does'))
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        "MatchPro™ is a real-time supply-demand matching engine built on top of Egypt's largest informal real estate data network — WhatsApp broker groups. It ingests, structures, and cross-matches every listing and buyer request across 50+ channels, surfacing actionable matches every 12 hours.",
        S['body']))
    story.append(Spacer(1, 10))

    for icon, title, body in [
        ('📡', 'Live Market Ingestion',
         'Processes messages from 50+ broker WhatsApp channels continuously. Supply and demand signals are extracted, structured, and stored — creating a proprietary database that grows daily.'),
        ('🎯', '3-Dimension Matching Engine',
         'Every supply listing is scored against every demand request across Location, Price, and Specifications. Only matches scoring >=70% are surfaced. Matches >=90% are flagged as "Very Hot Leads."'),
        ('📊', 'Intelligence Reports',
         'Every 12 hours, MatchPro™ generates ranked match reports for brokers, developers, and investors — segmented by area, transaction type, and confidence score.'),
    ]:
        story.append(FeatureBox(icon, title, body, w=CONTENT_W, h=105))
        story.append(Spacer(1, 10))

    story.append(PageBreak())

    # ── PAGE 4: TRACTION ───────────────────────────────────────────────────────
    story.append(SectionHeader('Real Traction — Real Data',
        'These are not projections. This is what MatchPro™ has already produced.'))
    story.append(Spacer(1, 14))

    stats = [
        ('5,569', 'Broker Messages Processed'),
        ('4,000', 'Supply Listings Extracted'),
        ('7,626', 'Demand Requests Captured'),
        ('56,566', 'AI Match Pairs Generated'),
        ('1,438', 'High-Confidence Matches (>=90%)'),
        ('50+', 'WhatsApp Broker Channels'),
        ('40+', 'Cairo Areas Covered'),
        ('$97.5M', 'Tracked Buyer Pipeline Value'),
    ]

    box_w = (CONTENT_W - 3 * 8) / 4
    for row_start in [0, 4]:
        row_boxes = stats[row_start:row_start + 4]
        row_data = [[StatBox(n, l, w=box_w, h=92) for n, l in row_boxes]]
        row_table = Table(row_data, colWidths=[box_w + 8] * 4, rowHeights=[96])
        row_table.setStyle(TableStyle([
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(row_table)
        story.append(Spacer(1, 8))

    story.append(Spacer(1, 8))
    story.append(HighlightBox(
        '7,626 buyers are chasing 4,000 listings — a 91% demand surplus. MatchPro™ has mapped this entire gap in real time. No other platform in Egypt has done this.',
        arabic='7,626 مشترٍ يبحثون عن 4,000 وحدة — فائض طلب 91%. ماتش برو™ رسم هذه الفجوة كاملةً في الوقت الفعلي.',
        w=CONTENT_W, h=78))

    story.append(PageBreak())

    # ── PAGE 5: PROOF OF CONCEPT ───────────────────────────────────────────────
    story.append(SectionHeader(
        'The POC — One Cycle Covers The Commitment',
        'Based on the smallest 12-hour output: 27 Very Hot Leads (>=90% match score). Sample: 24 April 2026, 22:00.'))
    story.append(Spacer(1, 12))

    poc_headers = ['KPI', 'Conservative', 'Base', 'Optimistic']
    poc_rows = [
        ['Very Hot Leads per 12-hr cycle', '27', '27', '27'],
        ['Lead-to-close conversion', '2%', '5%', '8%'],
        ['Closed deals per cycle', '0.54', '1.35', '2.16'],
        ['Avg property price (USD)', '$120,000', '$257,000', '$450,000'],
        ['Commission rate', '2.0%', '2.5%', '2.5%'],
        ['Platform take-rate', '30%', '30%', '30%'],
        ['Net revenue per cycle (USD)', '$194', '$2,607', '$7,776'],
        ['Cycles per month (2/day)', '60', '60', '60'],
        ['Net monthly revenue (USD)', '$11,664', '$156,420', '$466,560'],
        ['Months to cover $250K', '21.4', '1.6', '0.5'],
    ]

    cw = [CONTENT_W * 0.46, CONTENT_W * 0.18, CONTENT_W * 0.18, CONTENT_W * 0.18]
    poc_table = Table([poc_headers] + poc_rows, colWidths=cw, repeatRows=1)
    ts2 = std_ts()
    ts2.add('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold')
    ts2.add('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#EEF2FF'))
    poc_table.setStyle(ts2)
    story.append(poc_table)
    story.append(Spacer(1, 14))

    story.append(VerdictBox(
        'Even in the most conservative scenario, the $250,000 commitment is recovered in 21 months from the SMALLEST possible output. Base case: 1.6 months. This is not a projection — it is arithmetic applied to observed data.',
        arabic='حتى في السيناريو المتحفّظ يتم استرداد الالتزام من أصغر مخرَج خلال 21 شهراً. الحالة المتوسطة: 1.6 شهر.',
        w=CONTENT_W, h=95))

    story.append(PageBreak())

    # ── PAGE 6: BUSINESS MODEL ─────────────────────────────────────────────────
    story.append(SectionHeader('How MatchPro™ Makes Money'))
    story.append(Spacer(1, 10))

    revenue_streams = [
        ('1', 'Broker Subscription (SaaS)',
         ['Brokers pay a monthly fee for access to match reports for their target areas.',
          'Price point: $50–$200/month per broker',
          'TAM in Egypt: 50,000+ licensed brokers',
          'Target Y1: 500 subscribers = $300K–$1.2M ARR']),
        ('2', 'Developer Intelligence Feed',
         ['Real estate developers pay for live demand data: which areas, unit types, and price points are in highest demand — updated daily.',
          'Price point: $500–$2,000/month per developer',
          'Target Y1: 20 developers = $120K–$480K ARR']),
        ('3', 'Verified Lead Sales',
         ['Very Hot Leads (>=90% match) sold directly to brokers or developers on a per-lead basis.',
          'Price point: $50–$200 per verified lead',
          '27 leads/cycle × 60 cycles/month = 1,620 leads/month potential',
          'Target Y1 (10% monetized): $8,100–$32,400/month']),
        ('4', 'Transaction Commission Share',
         ["MatchPro™ facilitates the match; broker closes the deal; MatchPro™ earns 30% of the brokerage commission.",
          'On a $250K property at 2.5% commission: $1,875 per closed deal']),
    ]

    for num, title, lines in revenue_streams:
        body_paras = [Paragraph(f'<b>{title}</b>',
                                ParagraphStyle('rt', fontName='Helvetica-Bold', fontSize=10.5,
                                               textColor=NAVY, leading=15))]
        for ln in lines:
            body_paras.append(Paragraph(
                '• ' + ln,
                ParagraphStyle('rb', fontName='Helvetica', fontSize=9,
                               textColor=GREY_TEXT, leading=14, leftIndent=8)))

        box_data = [[
            Paragraph(f'<b>{num}</b>',
                      ParagraphStyle('num', fontName='Helvetica-Bold', fontSize=16,
                                     textColor=WHITE, alignment=TA_CENTER)),
            body_paras
        ]]
        box_table = Table(box_data, colWidths=[44, CONTENT_W - 44])
        box_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, 0), NAVY),
            ('BACKGROUND', (1, 0), (1, 0), LIGHT_BG),
            ('VALIGN', (0, 0), (0, 0), 'MIDDLE'),
            ('VALIGN', (1, 0), (1, 0), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('LEFTPADDING', (0, 0), (0, 0), 10),
            ('LEFTPADDING', (1, 0), (1, 0), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CCCCCC')),
            ('LINEBELOW', (0, 0), (-1, -1), 1, GOLD),
        ]))
        story.append(box_table)
        story.append(Spacer(1, 8))

    story.append(PageBreak())

    # ── PAGE 7: MARKET OPPORTUNITY ─────────────────────────────────────────────
    story.append(SectionHeader('The Market'))
    story.append(Spacer(1, 10))

    markets = [
        ('TAM — Total Addressable Market',
         "Egypt real estate transactions: $97.5B+ annual volume tracked in MatchPro™ pipeline alone. National market: EGP 1.2 trillion ($24B) annually. Source: JLL Egypt, 2026."),
        ('SAM — Serviceable Addressable Market',
         "Greater Cairo formal + informal broker market: 50,000+ brokers. Annual commission pool: ~$600M. MatchPro™ target: 2% market share = $12M ARR by Year 3."),
        ('SOM — Serviceable Obtainable Market',
         "Year 1 target: 500 broker subscribers + 20 developer feeds + lead sales = $1.5M–$2.5M revenue. Year 2: expand to Alexandria, Saudi Arabia, UAE."),
    ]

    mkt_col_w = (CONTENT_W - 2 * 6) / 3
    mkt_cells = []
    for title, body in markets:
        mkt_cells.append([
            Paragraph(f'<b>{title}</b>',
                      ParagraphStyle('mkt_t', fontName='Helvetica-Bold', fontSize=10,
                                     textColor=WHITE, leading=14)),
            Spacer(1, 6),
            Paragraph(body,
                      ParagraphStyle('mkt_b', fontName='Helvetica', fontSize=8.5,
                                     textColor=colors.HexColor('#CCCCCC'), leading=13)),
        ])

    mkt_table = Table([mkt_cells], colWidths=[mkt_col_w + 6] * 3, rowHeights=[160])
    mkt_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), NAVY),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 14),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LINEAFTER', (0, 0), (1, -1), 1, GOLD),
        ('BOX', (0, 0), (-1, -1), 2, GOLD),
    ]))
    story.append(mkt_table)
    story.append(Spacer(1, 14))

    story.append(Paragraph('<b>Regional Expansion</b>', S['h3']))
    story.append(Paragraph(
        'The identical model applies to Saudi Arabia (Riyadh, Jeddah) and UAE (Dubai, Abu Dhabi) — markets with even higher transaction volumes and broker fragmentation. Crystal Power Investments already operates in Saudi Arabia.',
        S['body']))

    story.append(PageBreak())

    # ── PAGE 8: COMPETITIVE ADVANTAGE ─────────────────────────────────────────
    story.append(SectionHeader('Why MatchPro™ Wins'))
    story.append(Spacer(1, 10))

    comp_headers = ['Feature', 'MatchPro™', 'Aqarmap', 'OLX', 'Prop. Finder', 'Manual Broker']
    comp_rows = [
        ['Real-time WhatsApp ingestion', '✅', '❌', '❌', '❌', '✅ (1 group)'],
        ['Cross-group matching', '✅', '❌', '❌', '❌', '❌'],
        ['50+ channel coverage', '✅', '❌', '❌', '❌', '❌'],
        ['Demand surplus mapping', '✅', '❌', '❌', '❌', '❌'],
        ['12-hour refresh cycle', '✅', '❌', '❌', '❌', '❌'],
        ['3-dimension scoring', '✅', '❌', '❌', '❌', '❌'],
        ['Informal market coverage', '✅', '❌', '❌', '❌', 'Partial'],
        ['Live developer intelligence', '✅', 'Partial', '❌', 'Partial', '❌'],
    ]

    cw_c = [CONTENT_W * 0.35, CONTENT_W * 0.13, CONTENT_W * 0.12, CONTENT_W * 0.10,
            CONTENT_W * 0.15, CONTENT_W * 0.15]
    comp_table = Table([comp_headers] + comp_rows, colWidths=cw_c, repeatRows=1)
    cts = std_ts()
    cts.add('ALIGN', (1, 0), (-1, -1), 'CENTER')
    cts.add('BACKGROUND', (1, 0), (1, 0), GOLD)
    cts.add('TEXTCOLOR', (1, 0), (1, 0), NAVY)
    cts.add('FONTNAME', (1, 0), (1, 0), 'Helvetica-Bold')
    for i in range(1, len(comp_rows) + 1):
        cts.add('BACKGROUND', (1, i), (1, i), colors.HexColor('#EEF7EE'))
        cts.add('TEXTCOLOR', (1, i), (1, i), colors.HexColor('#166534'))
        cts.add('FONTNAME', (1, i), (1, i), 'Helvetica-Bold')
    comp_table.setStyle(cts)
    story.append(comp_table)
    story.append(Spacer(1, 14))

    story.append(HighlightBox(
        "MatchPro™'s structural moat is the data network itself. Every broker channel added compounds the value for every other participant. This is a classic network effects business — the more brokers participate, the more valuable the matches become for everyone.",
        w=CONTENT_W, h=72))

    story.append(PageBreak())

    # ── PAGE 9: THE ASK ────────────────────────────────────────────────────────
    story.append(SectionHeader('The Investment Opportunity'))
    story.append(Spacer(1, 12))
    story.append(AskBox(w=CONTENT_W, h=72))
    story.append(Spacer(1, 14))

    allocations = [
        ('40%', 'Technology', 'Platform scaling, mobile app, API development'),
        ('30%', 'Sales & Growth', 'Broker onboarding, developer partnerships, marketing'),
        ('20%', 'Operations', 'Team, infrastructure, data quality'),
        ('10%', 'Legal & IP', 'Patents, licensing, regional expansion legal framework'),
    ]
    alloc_w = (CONTENT_W - 3 * 6) / 4
    alloc_cells = []
    for pct, title, desc in allocations:
        alloc_cells.append([
            Paragraph(f'<b>{pct}</b>',
                      ParagraphStyle('pct', fontName='Helvetica-Bold', fontSize=20,
                                     textColor=GOLD, alignment=TA_CENTER)),
            Spacer(1, 4),
            Paragraph(f'<b>{title}</b>',
                      ParagraphStyle('at', fontName='Helvetica-Bold', fontSize=9,
                                     textColor=WHITE, alignment=TA_CENTER, leading=13)),
            Spacer(1, 4),
            Paragraph(desc,
                      ParagraphStyle('ad', fontName='Helvetica', fontSize=8,
                                     textColor=colors.HexColor('#AAAAAA'), alignment=TA_CENTER, leading=11)),
        ])
    alloc_table = Table([alloc_cells], colWidths=[alloc_w + 6] * 4, rowHeights=[110])
    alloc_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), NAVY),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 14),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('LINEAFTER', (0, 0), (2, -1), 0.5, GOLD),
        ('BOX', (0, 0), (-1, -1), 1.5, GOLD),
    ]))
    story.append(alloc_table)
    story.append(Spacer(1, 14))

    story.append(Paragraph('<b>Milestones</b>', S['h3']))
    ms_data = [
        ['Milestone', 'Timeline', 'KPI'],
        ['500 broker subscribers', 'Month 6', '$25K MRR'],
        ['Developer intelligence product launch', 'Month 4', '10 pilot customers'],
        ['Saudi Arabia pilot', 'Month 9', '50 brokers'],
        ['$1M ARR', 'Month 12', 'Break-even'],
        ['Series A ready', 'Month 18', '$3M ARR'],
    ]
    ms_table = Table(ms_data, colWidths=[CONTENT_W * 0.55, CONTENT_W * 0.20, CONTENT_W * 0.25], repeatRows=1)
    ms_table.setStyle(std_ts())
    story.append(ms_table)
    story.append(Spacer(1, 10))
    story.append(VerdictBox(
        'Current pre-money valuation: $1,000,000 – $6,000,000 USD based on proprietary data asset, proven matching infrastructure, and $97.5M tracked pipeline. Comparable SaaS/PropTech platforms in MENA at similar stage: $3M–$8M pre-money.',
        w=CONTENT_W, h=70))

    story.append(PageBreak())

    # ── PAGE 10: THE TEAM ──────────────────────────────────────────────────────
    story.append(SectionHeader('The Team'))
    story.append(Spacer(1, 12))

    team = [
        ("Mo'men Maisara — Founder & CEO",
         "Founder of Crystal Power Investments. BBA, Arab Academy for Science & Technology. Multi-sector entrepreneur operating across Egypt, Saudi Arabia, Germany, and Japan. Built MatchPro™ from zero to 56,566 AI-generated matches and $97.5M tracked pipeline. No-commission, client-first philosophy. Proven across real estate, hospitality, education, and technology."),
        ('Crystal Power Investments — The Operator',
         'Founded February 2022. Documented 366% ROI. 100+ deployed projects. 98% client satisfaction. Active across real estate, schools catering (53 schools, 10,000+ students), hospitality, and technology. Already operates in 4 countries.'),
    ]

    for name, bio in team:
        td = [
            [Paragraph(f'<b>{name}</b>',
                       ParagraphStyle('tn', fontName='Helvetica-Bold', fontSize=11,
                                      textColor=NAVY, leading=15))],
            [Paragraph(bio, S['body'])],
        ]
        tt = Table(td, colWidths=[CONTENT_W])
        tt.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), LIGHT_BG),
            ('BACKGROUND', (0, 1), (-1, 1), WHITE),
            ('LEFTPADDING', (0, 0), (-1, -1), 14),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('TOPPADDING', (0, 1), (-1, 1), 8),
            ('BOTTOMPADDING', (0, 1), (-1, 1), 12),
            ('LINEBEFORE', (0, 0), (-1, -1), 4, GOLD),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
        ]))
        story.append(tt)
        story.append(Spacer(1, 12))

    story.append(HighlightBox(
        'Advisory Need: Seeking experienced PropTech / MENA VC advisors to join the board as part of this round.',
        w=CONTENT_W, h=55))

    story.append(PageBreak())

    # ── PAGE 11: RISK REGISTER ─────────────────────────────────────────────────
    story.append(SectionHeader('Risk Register'))
    story.append(Spacer(1, 10))

    risk_data = [
        ['Risk', 'Likelihood', 'Mitigation'],
        ['WhatsApp policy change', 'Medium', 'Multi-channel ingestion + proprietary broker network'],
        ['Broker adoption resistance', 'Low', 'Free tier + demonstrated ROI before paywall'],
        ['Competitor replication', 'Low', '12-month data moat + network effects'],
        ['Regulatory (data privacy)', 'Low', 'GDPR-aligned data handling, no PII sold'],
        ['FX / Egypt macro risk', 'Medium', 'USD pricing for enterprise; EGP for retail'],
        ['Scaling technical infrastructure', 'Low', 'Cloud-native, auto-scaling architecture'],
    ]

    risk_cw = [CONTENT_W * 0.35, CONTENT_W * 0.15, CONTENT_W * 0.50]
    risk_table = Table(risk_data, colWidths=risk_cw, repeatRows=1)
    rts = std_ts()
    for i, row in enumerate(risk_data[1:], 1):
        lik = row[1]
        if lik == 'Medium':
            rts.add('BACKGROUND', (1, i), (1, i), colors.HexColor('#FEF9C3'))
            rts.add('TEXTCOLOR', (1, i), (1, i), colors.HexColor('#92400E'))
            rts.add('FONTNAME', (1, i), (1, i), 'Helvetica-Bold')
        elif lik == 'Low':
            rts.add('BACKGROUND', (1, i), (1, i), colors.HexColor('#DCFCE7'))
            rts.add('TEXTCOLOR', (1, i), (1, i), colors.HexColor('#166534'))
            rts.add('FONTNAME', (1, i), (1, i), 'Helvetica-Bold')
    risk_table.setStyle(rts)
    story.append(risk_table)

    story.append(PageBreak())

    # ── PAGE 12: NEXT STEPS ────────────────────────────────────────────────────
    story.append(SectionHeader('Next Steps'))
    story.append(Spacer(1, 12))

    steps = [
        ('1', 'NDA & Term Sheet\n(Week 1)',
         'Sign mutual NDA. Review draft term sheet. Confirm investment size and structure (equity / SAFE / convertible note).'),
        ('2', 'Due Diligence\n(Weeks 2–3)',
         'Full platform demo. Data room access: MatchPro™ live system, match reports, financial model, legal structure. Reference calls with broker partners.'),
        ('3', 'Close & Deploy\n(Week 4)',
         'Signed agreement. Wire transfer. Onboarding call with technical and commercial team. First milestone review at 30 days.'),
    ]

    step_col_w = (CONTENT_W - 2 * 8) / 3
    step_cells = []
    for num, title, desc in steps:
        step_cells.append([
            Paragraph(f'<b>{num}</b>',
                      ParagraphStyle('sn', fontName='Helvetica-Bold', fontSize=24,
                                     textColor=GOLD, alignment=TA_CENTER)),
            Spacer(1, 4),
            Paragraph(f'<b>{title.replace(chr(10), " ")}</b>',
                      ParagraphStyle('st', fontName='Helvetica-Bold', fontSize=10,
                                     textColor=NAVY, alignment=TA_CENTER, leading=14)),
            Spacer(1, 6),
            Paragraph(desc,
                      ParagraphStyle('sd', fontName='Helvetica', fontSize=9,
                                     textColor=GREY_TEXT, alignment=TA_CENTER, leading=13)),
        ])

    step_table = Table([step_cells], colWidths=[step_col_w + 8] * 3, rowHeights=[160])
    step_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 18),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('LINEAFTER', (0, 0), (1, -1), 1.5, GOLD),
        ('BOX', (0, 0), (-1, -1), 1.5, NAVY),
        ('LINEBELOW', (0, 0), (-1, -1), 2.5, GOLD),
    ]))
    story.append(step_table)
    story.append(Spacer(1, 20))
    story.append(ContactBox(w=CONTENT_W, h=110))

    story.append(PageBreak())

    # ── PAGE 13: LEGAL DISCLAIMER ──────────────────────────────────────────────
    story.append(SectionHeader('Important Notice'))
    story.append(Spacer(1, 16))

    story.append(Paragraph(
        'This document has been prepared by Crystal Power Investments solely for informational purposes '
        'and does not constitute an offer to sell or a solicitation of an offer to buy any securities. '
        'The information contained herein is confidential and is intended only for the person to whom '
        'it has been delivered. Recipients must not reproduce, distribute, or use this document without '
        'the prior written consent of Crystal Power Investments. Forward-looking statements are based on '
        'current assumptions and involve known and unknown risks. Actual results may differ materially. '
        'Crystal Power Investments is incorporated and operating in Egypt. This document does not '
        'constitute financial advice.',
        S['disclaimer']))
    story.append(Spacer(1, 14))
    story.append(HRFlowable(width=CONTENT_W, thickness=1, color=GOLD, spaceAfter=12))
    story.append(Paragraph(
        'تم إعداد هذه الوثيقة من قِبَل Crystal Power Investments لأغراض إعلامية فحسب، '
        'ولا تُمثّل عرضاً أو دعوة لشراء أي أوراق مالية. '
        'المعلومات الواردة فيها سرية ومخصصة للمستلم المُحدَّد فقط.',
        S['arabic']))
    story.append(Spacer(1, 20))
    story.append(VerdictBox(
        'STRICTLY CONFIDENTIAL. This document and its contents are the exclusive property of Crystal Power Investments. Unauthorized disclosure is prohibited.',
        w=CONTENT_W, h=60))

    # ── BUILD ──────────────────────────────────────────────────────────────────
    doc.build(story, onFirstPage=on_first_page, onLaterPages=on_later_pages)
    size = os.path.getsize(OUT_PATH)
    print(f'✅ PDF saved to: {OUT_PATH}')
    print(f'   File size: {size:,} bytes ({size/1024:.1f} KB)')


if __name__ == '__main__':
    build()
