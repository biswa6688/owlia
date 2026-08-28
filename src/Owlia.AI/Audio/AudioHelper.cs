using System.Diagnostics;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;

namespace Owlia.AI.Audio;

/// <summary>
/// Extracts 16 kHz mono PCM float[] from any audio/video file using ffmpeg.
/// Falls back to NAudio for WAV files if ffmpeg is not available.
/// </summary>
public static class AudioHelper
{
    private const int TargetSampleRate = 16000;

    /// <summary>
    /// Returns a float[] of normalised mono PCM samples at 16 kHz.
    /// </summary>
    public static async Task<float[]> LoadPcmAsync(string filePath, CancellationToken ct = default)
    {
        if (!File.Exists(filePath))
            throw new FileNotFoundException("Media file not found", filePath);

        // Try ffmpeg first (handles any container / codec)
        var ffmpegPath = FindFfmpeg();
        if (ffmpegPath is not null)
            return await ExtractWithFfmpegAsync(filePath, ffmpegPath, ct);

        // Fallback: NAudio (WAV only, 16 kHz mono ideal)
        return LoadWithNAudio(filePath);
    }

    // ── ffmpeg ────────────────────────────────────────────────────────────

    private static async Task<float[]> ExtractWithFfmpegAsync(
        string inputPath, string ffmpegPath, CancellationToken ct)
    {
        // ffmpeg -i <input> -ac 1 -ar 16000 -f f32le -  (pipe raw float32 to stdout)
        var psi = new ProcessStartInfo(ffmpegPath,
            $"-y -i \"{inputPath}\" -ac 1 -ar {TargetSampleRate} -f f32le -")
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        using var proc = Process.Start(psi)
            ?? throw new InvalidOperationException("Failed to start ffmpeg");

        using var ms = new MemoryStream();
        await proc.StandardOutput.BaseStream.CopyToAsync(ms, ct);
        await proc.WaitForExitAsync(ct);

        if (proc.ExitCode != 0)
        {
            var err = await proc.StandardError.ReadToEndAsync(ct);
            throw new InvalidOperationException($"ffmpeg failed (exit {proc.ExitCode}): {err}");
        }

        var bytes = ms.ToArray();
        var samples = new float[bytes.Length / 4];
        Buffer.BlockCopy(bytes, 0, samples, 0, bytes.Length);
        return samples;
    }

    private static string? FindFfmpeg()
    {
        // 1) Bundled next to exe
        var bundled = Path.Combine(AppContext.BaseDirectory, "ffmpeg.exe");
        if (File.Exists(bundled)) return bundled;

        // 2) PATH
        try
        {
            var psi = new ProcessStartInfo("where", "ffmpeg")
            {
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            using var p = Process.Start(psi)!;
            var line = p.StandardOutput.ReadLine();
            p.WaitForExit(1000);
            if (p.ExitCode == 0 && !string.IsNullOrWhiteSpace(line))
                return line.Trim();
        }
        catch { /* ffmpeg not found */ }

        return null;
    }

    // ── NAudio fallback ───────────────────────────────────────────────────

    private static float[] LoadWithNAudio(string filePath)
    {
        using var reader = new AudioFileReader(filePath);

        ISampleProvider provider = reader;

        // Resample if needed
        if (reader.WaveFormat.SampleRate != TargetSampleRate)
            provider = new WdlResamplingSampleProvider(provider, TargetSampleRate);

        // Mono mix-down
        if (provider.WaveFormat.Channels > 1)
            provider = new StereoToMonoSampleProvider(provider);

        var list = new List<float>(TargetSampleRate * 60);
        var buf = new float[4096];
        int read;
        while ((read = provider.Read(buf.AsSpan())) > 0)
        {
            for (int i = 0; i < read; i++)
                list.Add(buf[i]);
        }

        return list.ToArray();
    }
}
