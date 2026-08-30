/**
 * ffmpeg-static ships no type definitions.
 * Its only export is the absolute path of the ffmpeg binary bundled for the current
 * platform, or null when the platform is not supported.
 */
declare module "ffmpeg-static" {
    const ffmpegPath: string | null;
    export default ffmpegPath;
}
