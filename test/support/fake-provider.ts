import type { ArrivalPrediction, RequestContext, TransportProvider } from '../../src/domain/types';

type StopResponse = ArrivalPrediction[] | Error;

/** Provedor fake: devolve previsões ou falhas pré-configuradas por ponto e registra as consultas. */
export class FakeTransportProvider implements TransportProvider {
  readonly calls: string[] = [];

  constructor(private readonly responses: Record<string, StopResponse> = {}) {}

  async getArrivals(stopId: string, _context: RequestContext): Promise<ArrivalPrediction[]> {
    this.calls.push(stopId);
    const response = this.responses[stopId] ?? [];
    if (response instanceof Error) throw response;
    return response;
  }
}
