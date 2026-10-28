import type { ArrivalPrediction, RequestContext, TransportProvider, VehiclePosition } from '../../src/domain/types';

type StopResponse = ArrivalPrediction[] | Error;
type LineResponse = VehiclePosition[] | Error;

/**
 * Provedor fake: devolve previsões (por ponto) e posições (por linha) ou falhas pré-configuradas,
 * registrando as consultas em `calls` (pontos) e `positionCalls` (linhas).
 */
export class FakeTransportProvider implements TransportProvider {
  readonly calls: string[] = [];
  readonly positionCalls: string[] = [];

  constructor(
    private readonly responses: Record<string, StopResponse> = {},
    private readonly positions: Record<string, LineResponse> = {},
  ) {}

  async getArrivals(stopId: string, _context: RequestContext): Promise<ArrivalPrediction[]> {
    this.calls.push(stopId);
    const response = this.responses[stopId] ?? [];
    if (response instanceof Error) throw response;
    return response;
  }

  async getVehiclePositions(lineId: string, _context: RequestContext): Promise<VehiclePosition[]> {
    this.positionCalls.push(lineId);
    const response = this.positions[lineId] ?? [];
    if (response instanceof Error) throw response;
    return response;
  }
}
