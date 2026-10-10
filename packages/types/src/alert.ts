export type AlertType =
  'sanctions' | 'risk_increase' | 'disruption' | 'disaster' | 'closure';

export type AlertSeverity = 'critical' | 'elevated' | 'watch';

export type AlertStatus = 'open' | 'acknowledged' | 'dismissed';

export type Alert = {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  status: AlertStatus;
  supplierId: string | null;
  routeId: string | null;
  supplierName: string | null;
  routeLabel: string | null;
  recommendationId: string | null;
  createdAt: string;
};

export type AlertListResponse = {
  alerts: Alert[];
};

export type AlertCreatedMessage = {
  alertId: string;
};
