import type { ArrivalPrediction, TransportProvider, VehiclePosition } from '../../domain/types';

/**
 * Provedor usado enquanto o adaptador SPTrans não existe (issue #5):
 * falha em toda consulta para que a skill responda "serviço indisponível" em vez de inventar previsões.
 */
export class UnconfiguredTransportProvider implements TransportProvider {
  async getArrivals(): Promise<ArrivalPrediction[]> {
    throw new Error('Provedor de transporte não configurado');
  }

  /** Sem provedor configurado não há posições: falha para a linha entrar em `failedLineIds`, nunca devolve lista vazia. */
  async getVehiclePositions(): Promise<VehiclePosition[]> {
    throw new Error('Provedor de transporte não configurado');
  }
}
