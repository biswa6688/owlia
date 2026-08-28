namespace Owlia.Core.Services;

public interface ITtsService
{
    Task<byte[]> SynthesizeAsync(string text, string voice, CancellationToken ct = default);
}
