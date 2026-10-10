import { useEffect, useRef, useState } from 'react';
import type {
  AgentName,
  PipelineRun,
  PipelineSchedule,
  PipelineStage,
} from '@supplyeagle/types';
import {
  AGENT_ORDER,
  agentLabel,
  formatClock,
  formatCountdown,
} from './agent-label';
import { ScanDrawer } from './scan-drawer';
import { usePipelineStatus, useTriggerScan } from './use-pipeline';

export function ScanBanner() {
  const status = usePipelineStatus();
  const trigger = useTriggerScan();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const watchedRun = useRef<string | null>(null);
  const schedule = status.data?.schedule;
  const active = status.data?.activeRun ?? null;
  const latest = status.data?.latestRun ?? null;
  const shown = active ?? latest;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (active) {
      watchedRun.current = active.id;
      return;
    }
    const finishedId = watchedRun.current;
    if (!finishedId || latest?.id !== finishedId) {
      return;
    }
    if (latest.status === 'completed' || latest.status === 'failed') {
      watchedRun.current = null;
      setOpen(true);
    }
  }, [active, latest]);

  return (
    <>
      <div className={active ? 'scan-banner running' : 'scan-banner'}>
        <button
          type="button"
          className="scan-open"
          onClick={() => setOpen(true)}
        >
          <span className="scan-when">{whenLabel(schedule, active, now)}</span>
          {active ? (
            <span className="scan-track" aria-hidden="true">
              {AGENT_ORDER.map((name, index) => {
                const stage = stageFor(name, shown);
                const previous = index > 0 ? AGENT_ORDER[index - 1] : undefined;
                return (
                  <span key={name} className="scan-step">
                    {previous ? (
                      <span
                        className={linkClass(stageFor(previous, shown), stage)}
                      />
                    ) : null}
                    <span
                      className={nodeClass(stage)}
                      title={agentLabel(name)}
                    />
                  </span>
                );
              })}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => trigger.mutate()}
          disabled={Boolean(active) || trigger.isPending || status.isPending}
        >
          {active ? 'Running' : 'Run'}
        </button>
      </div>
      {open ? <ScanDrawer run={shown} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function stageFor(
  name: AgentName,
  run: PipelineRun | null,
): PipelineStage | null {
  return run?.stages.find((stage) => stage.agentName === name) ?? null;
}

function nodeClass(stage: PipelineStage | null): string {
  if (stage?.status === 'running') {
    return 'scan-node active';
  }
  if (stage?.status === 'completed') {
    return 'scan-node done';
  }
  if (stage?.status === 'failed') {
    return 'scan-node failed';
  }
  return 'scan-node';
}

function linkClass(
  previous: PipelineStage | null,
  current: PipelineStage | null,
): string {
  if (previous?.status === 'running') {
    return 'scan-link flow';
  }
  if (
    previous?.status === 'completed' &&
    current &&
    current.status !== 'pending'
  ) {
    return 'scan-link done';
  }
  return 'scan-link';
}

function whenLabel(
  schedule: PipelineSchedule | undefined,
  active: PipelineRun | null,
  now: number,
): string {
  const running = active?.stages.find((stage) => stage.status === 'running');
  if (running) {
    return agentLabel(running.agentName);
  }
  if (active) {
    return 'Queued';
  }
  if (!schedule) {
    return 'Scan';
  }
  if (!schedule.enabled) {
    return 'Off';
  }
  if (!schedule.nextRunAt) {
    return formatClock(schedule.hour, schedule.minute);
  }
  const countdown = formatCountdown(schedule.nextRunAt, now);
  if (!countdown) {
    return 'Due';
  }
  const compact = countdown.includes('h ')
    ? countdown.replace(/ \d+s$/, '')
    : countdown;
  return `Next Pipeline Run: ${compact}`;
}
