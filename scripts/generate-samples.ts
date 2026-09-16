import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

async function writePdf(filePath: string, draw: (pdf: PDFDocument) => Promise<void> | void): Promise<void> {
  const pdf = await PDFDocument.create()
  await draw(pdf)
  const bytes = await pdf.save()
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, bytes)
}

async function addLetterPage(pdf: PDFDocument, title: string, lines: string[]): Promise<void> {
  const page = pdf.addPage([612, 792])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(1, 0.996, 0.973) })
  page.drawText(title, { x: 54, y: 720, size: 22, font: bold, color: rgb(0.1, 0.09, 0.07) })
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: 54,
      y: 670 - index * 28,
      size: 14,
      font,
      color: rgb(0.2, 0.18, 0.14)
    })
    page.drawLine({
      start: { x: 54, y: 662 - index * 28 },
      end: { x: 558, y: 662 - index * 28 },
      thickness: 0.6,
      color: rgb(0.82, 0.78, 0.7)
    })
  })
}

async function main(): Promise<void> {
  const samples = path.resolve('samples')
  await writePdf(path.join(samples, 'math-worksheet.pdf'), async (pdf) => {
    await addLetterPage(pdf, 'Fractions Practice', [
      '1.  1/2 + 1/4 = ________',
      '2.  3/5 - 1/5 = ________',
      '3.  2/3 x 3/4 = ________',
      '4.  Circle the larger number:  5/8    3/4',
      '5.  Show your work in the space below.'
    ])
  })

  await writePdf(path.join(samples, 'lined-notes.pdf'), (pdf) => {
    const page = pdf.addPage([612, 792])
    page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(1, 0.996, 0.973) })
    for (let y = 72; y < 740; y += 28) {
      page.drawLine({
        start: { x: 54, y },
        end: { x: 558, y },
        thickness: 0.6,
        color: rgb(0.75, 0.7, 0.62)
      })
    }
  })

  await writePdf(path.join(samples, 'multi-page.pdf'), async (pdf) => {
    await addLetterPage(pdf, 'Chapter Review, page 1', ['Define habitat.', 'Give one example of a food chain.'])
    await addLetterPage(pdf, 'Chapter Review, page 2', ['What is photosynthesis?', 'Draw a simple water cycle.'])
    await addLetterPage(pdf, 'Chapter Review, page 3', ['List two renewable resources.', 'Why do scientists use models?'])
  })

  await writePdf(path.join(samples, 'shapes-sample.pdf'), async (pdf) => {
    const page = pdf.addPage([612, 792])
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    page.drawText('Shapes and labels', { x: 54, y: 720, size: 20, font, color: rgb(0.1, 0.09, 0.07) })
    page.drawRectangle({ x: 80, y: 500, width: 160, height: 120, borderColor: rgb(0.12, 0.3, 0.47), borderWidth: 1.5 })
    page.drawEllipse({ x: 380, y: 560, xScale: 70, yScale: 50, borderColor: rgb(0.42, 0.23, 0.16), borderWidth: 1.5 })
    page.drawLine({ start: { x: 80, y: 400 }, end: { x: 500, y: 400 }, thickness: 1.2, color: rgb(0.1, 0.09, 0.07) })
    page.drawText('Label the rectangle, ellipse, and line.', { x: 54, y: 340, size: 14, font })
  })
}

void main()
