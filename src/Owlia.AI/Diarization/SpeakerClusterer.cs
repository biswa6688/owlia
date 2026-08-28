namespace Owlia.AI.Diarization;

/// <summary>
/// Agglomerative clustering of speaker embeddings into speaker labels.
/// Uses cosine distance (embeddings are L2 normalised so cosine ≡ dot product distance).
/// </summary>
public static class SpeakerClusterer
{
    /// <summary>
    /// Assigns a speaker label ("Speaker 0", "Speaker 1", …) to each embedding.
    /// </summary>
    public static string[] Cluster(float[][] embeddings, float distanceThreshold = 0.35f)
    {
        if (embeddings.Length == 0) return Array.Empty<string>();

        int n = embeddings.Length;
        var labels = Enumerable.Range(0, n).ToArray(); // initially each segment is its own cluster

        // Build distance matrix
        var dist = new float[n, n];
        for (int i = 0; i < n; i++)
            for (int j = i + 1; j < n; j++)
            {
                float d = CosineDistance(embeddings[i], embeddings[j]);
                dist[i, j] = dist[j, i] = d;
            }

        // Agglomerative — merge closest pair below threshold iteratively
        bool merged;
        do
        {
            merged = false;
            float minDist = float.MaxValue;
            int mergeA = -1, mergeB = -1;

            for (int i = 0; i < n; i++)
                for (int j = i + 1; j < n; j++)
                {
                    if (labels[i] == labels[j]) continue;
                    if (dist[i, j] < minDist)
                    {
                        minDist = dist[i, j];
                        mergeA = i;
                        mergeB = j;
                    }
                }

            if (mergeA >= 0 && minDist <= distanceThreshold)
            {
                int oldLabel = labels[mergeB];
                int newLabel = labels[mergeA];
                for (int k = 0; k < n; k++)
                    if (labels[k] == oldLabel)
                        labels[k] = newLabel;
                merged = true;
            }
        } while (merged);

        // Remap labels to compact 0-based integers
        var uniqueLabels = labels.Distinct().OrderBy(x => x).ToArray();
        var remap = uniqueLabels.Select((l, i) => (l, i)).ToDictionary(x => x.l, x => x.i);

        return labels.Select(l => $"Speaker {remap[l]}").ToArray();
    }

    private static float CosineDistance(float[] a, float[] b)
    {
        float dot = 0;
        for (int i = 0; i < a.Length; i++)
            dot += a[i] * b[i];
        return 1f - dot; // already L2-normalised
    }
}
