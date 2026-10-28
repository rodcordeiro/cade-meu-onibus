/** Linha favorita, identificada pelo código oficial do provedor de transporte. */
export interface FavoriteLine {
  id: string;
  label: string;
  aliases?: string[];
  direction?: string;
  arrivalSource?: 'forecast' | 'position';
}

export interface ReferencePoint {
  name: string;
  lat: number;
  lon: number;
}

export interface StopApproach {
  lineId: string;
  references: ReferencePoint[];
}

/** Ponto monitorado, com código oficial e as linhas favoritas consultadas nele. */
export interface MonitoredStop {
  id: string;
  alias: string;
  lineIds: string[];
  aliases?: string[];
  approaches?: StopApproach[];
}

/** Documento de favoritos validado. */
export interface FavoritesConfig {
  version: 1;
  stops: MonitoredStop[];
  lines: FavoriteLine[];
}

/** Previsão de chegada normalizada pelo provedor de transporte. */
export interface ArrivalPrediction {
  stopId: string;
  lineId: string;
  vehicleId?: string;
  arrivalAt: Date;
  observedAt: Date;
  direction?: string;
  scheduledAt?: Date;
}

/** Cobertura da consulta: todos os pontos responderam, apenas alguns, ou nenhum. */
export type ArrivalStatus = 'complete' | 'partial' | 'unavailable';

/** Resultado agregado de uma consulta de chegadas. */
export interface ArrivalResult {
  predictions: ArrivalPrediction[];
  queriedStopIds: string[];
  failedStopIds: string[];
  status: ArrivalStatus;
  /** Quantidade de previsões do par ponto–linha favorito descartadas por estarem fora da janela. */
  outsideWindowCount: number;
}

/** Contexto de uma requisição ao provedor, independente de Alexa/AWS. */
export interface RequestContext {
  now: Date;
}

/** Porta para o provedor de previsões (SPTrans Olho Vivo no MVP). */
export interface TransportProvider {
  getArrivals(stopId: string, context: RequestContext): Promise<ArrivalPrediction[]>;
}
