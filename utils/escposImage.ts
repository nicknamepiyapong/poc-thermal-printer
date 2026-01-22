
import { Buffer } from 'buffer'
import RNFS from 'react-native-fs'

type EscposImageOptions = {
    paperWidthDots?: number // 384 สำหรับ 58mm
    threshold?: number // 0..255
    dither?: boolean
}

export async function convertImageUriToEscPosRasterBytes(
    imageUri: string,
    options: EscposImageOptions = {}
): Promise<Uint8Array> {
    const paperWidthDots = options.paperWidthDots ?? 384
    const threshold = options.threshold ?? 180
    const dither = options.dither ?? true

    // ✅ อ่านไฟล์รูปเป็น base64
    const base64 = await RNFS.readFile(imageUri, 'base64')

    // ✅ แปลง base64 -> bytes (นี่ไม่ใช่การแปลงขาวดำ แค่ decode ไฟล์)
    const bytes = Buffer.from(base64, 'base64') // Buffer = Uint8Array

    return bytes
}
