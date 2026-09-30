/// High-ratio DEFLATE compression and ultra-fast INFLATE decompression
pub struct Compressor;

impl Compressor {
    pub fn compress(data: &[u8], level: u8) -> Vec<u8> {
        let level = if level == 0 { 6 } else { level.min(10) };
        let compressed = miniz_oxide::deflate::compress_to_vec(data, level);

        let mut out = Vec::with_capacity(4 + compressed.len());
        out.extend_from_slice(&(data.len() as u32).to_le_bytes());
        out.extend_from_slice(&compressed);
        out
    }

    pub fn decompress(data: &[u8]) -> Option<Vec<u8>> {
        if data.len() < 4 {
            return None;
        }
        let compressed_payload = &data[4..];
        miniz_oxide::inflate::decompress_to_vec(compressed_payload).ok()
    }
}
