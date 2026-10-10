export function LaneTitle({
  origin,
  destination,
}: {
  origin: string;
  destination: string;
}) {
  return (
    <span className="lane-title">
      <span>{origin}</span>
      <span className="lane-flow" aria-hidden="true">
        <span className="lane-flow-track" />
        <span className="lane-flow-dot" />
      </span>
      <span className="visually-hidden">to</span>
      <span>{destination}</span>
    </span>
  );
}
