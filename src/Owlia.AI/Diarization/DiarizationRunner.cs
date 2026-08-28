using SherpaOnnx;

namespace Owlia.AI.Diarization;

/// <summary>
/// Speaker diarization via sherpa-onnx's OfflineSpeakerDiarization — segmentation
/// (pyannote), embedding (WeSpeaker), and clustering all handled internally.
/// Replaces the previous hand-rolled EmbeddingRunner + SegmentationRunner +
/// SpeakerClusterer pipeline.
/// </summary>
public sealed class DiarizationRunner : IDisposable
{
    private readonly OfflineSpeakerDiarization _sd;

    public DiarizationRunner(string segmentationModelPath, string embeddingModelPath)
    {
        var config = new OfflineSpeakerDiarizationConfig();
        config.Segmentation.Pyannote.Model = segmentationModelPath;
        config.Embedding.Model = embeddingModelPath;
        // Speaker count is unknown ahead of time — cluster by similarity
        // threshold instead of a fixed NumClusters.
        config.Clustering.Threshold = 0.5f;

        _sd = new OfflineSpeakerDiarization(config);
    }

    public List<DiarizationSegment> Diarize(float[] audio)
    {
        var segments = _sd.Process(audio);
        return segments
            .Select(s => new DiarizationSegment { StartSec = s.Start, EndSec = s.End, Speaker = s.Speaker })
            .ToList();
    }

    public void Dispose() => _sd.Dispose();
}

public sealed class DiarizationSegment
{
    public double StartSec { get; set; }
    public double EndSec { get; set; }
    public int Speaker { get; set; }
}
