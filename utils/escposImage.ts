import { Buffer } from 'buffer'
import RNFS from 'react-native-fs'
import { PNG } from 'react-native-png-stream-browserify'
import jpeg from 'jpeg-js'

type EscposImageOptions = {
    paperWidthDots?: number // 384 = 58mm
    threshold?: number // 0..255
}

function rgbaToLuma(r: number, g: number, b: number) {
    // ฟังก์ชันแปลงสีเป็นความสว่าง (Luma)
    // นี่คือสูตรมาตรฐานในการแปลง RGB → “ความสว่าง” (Grayscale)
    // ถ้า luma ต่ำ = สีเข้ม = ควรพิมพ์เป็น “ดำ”
    // ถ้า luma สูง = สีสว่าง = “ขาว” ไม่ต้องพิมพ์

    return 0.299 * r + 0.587 * g + 0.114 * b
}


export async function convertImageUriToEscPosRasterBytes(
    imageUri: string,
    options: EscposImageOptions = {}
): Promise<Uint8Array> {
    const paperWidthDots = options.paperWidthDots ?? 384
    const threshold = options.threshold ?? 180

    // ✅ read file -> bytes
    const base64 = await RNFS.readFile(imageUri, 'base64')
    const fileBytes = Buffer.from(base64, 'base64')

    // ✅ detect format
    const isPng =
        fileBytes.length > 8 &&
        fileBytes[0] === 0x89 &&
        fileBytes[1] === 0x50 &&
        fileBytes[2] === 0x4e &&
        fileBytes[3] === 0x47

    const isJpg = fileBytes.length > 2 && fileBytes[0] === 0xff && fileBytes[1] === 0xd8

    let width = 0
    let height = 0
    let rgba: Uint8Array

    if (isPng) {
        const decoded = PNG.sync.read(Buffer.from(fileBytes)) as any
        width = decoded.width
        height = decoded.height
        rgba = decoded.data
    } else if (isJpg) {
        const decoded = jpeg.decode(fileBytes, { useTArray: true })
        width = decoded.width
        height = decoded.height
        rgba = decoded.data
    } else {
        throw new Error('Unsupported image format (PNG/JPG only)')
    }

    // ✅ scale ให้พอดีกระดาษ
    const targetWidth = Math.min(paperWidthDots, width)
    const scale = targetWidth / width
    const targetHeight = Math.max(1, Math.floor(height * scale))

    const bytesPerRow = Math.ceil(targetWidth / 8)
    const imageData = new Uint8Array(bytesPerRow * targetHeight)

    // ✅ nearest-neighbor scale + threshold (แปลงภาพสีเป็น ขาว กับ ดำ)
    for (let y = 0; y < targetHeight; y++) {
        const srcY = Math.min(height - 1, Math.floor(y / scale))

        for (let x = 0; x < targetWidth; x++) {
            const srcX = Math.min(width - 1, Math.floor(x / scale))

            const idx = (srcY * width + srcX) * 4
            const r = rgba[idx]
            const g = rgba[idx + 1]
            const b = rgba[idx + 2]
            const a = rgba[idx + 3]

            const luma = a < 128 ? 255 : rgbaToLuma(r, g, b)
            // ตัดสินใจว่า pixel นี้จะเป็น “ดำ” หรือ “ขาว”
            const isBlack = luma < threshold

            if (isBlack) {
                const byteIndex = y * bytesPerRow + (x >> 3)
                const bitIndex = 7 - (x & 7)
                imageData[byteIndex] |= 1 << bitIndex
            }
        }
    }

    // ✅ GS v 0 raster command
    const xL = bytesPerRow & 0xff
    const xH = (bytesPerRow >> 8) & 0xff
    const yL = targetHeight & 0xff
    const yH = (targetHeight >> 8) & 0xff

    const header = new Uint8Array([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH])

    const out = new Uint8Array(header.length + imageData.length)
    out.set(header, 0)
    out.set(imageData, header.length)

    return out
}
