'use client';

export default function BadmintonShuttle({ className = '' }) {
  return (
    <span className={'badminton-shuttle ' + className} aria-hidden="true">
      <span className="badminton-shuttle-feathers">
        <i className="shuttle-feather shuttle-feather-1" />
        <i className="shuttle-feather shuttle-feather-2" />
        <i className="shuttle-feather shuttle-feather-3" />
        <i className="shuttle-feather shuttle-feather-4" />
        <i className="shuttle-feather shuttle-feather-5" />
        <i className="shuttle-feather shuttle-feather-6" />
        <i className="shuttle-feather shuttle-feather-7" />
      </span>
      <span className="badminton-shuttle-ring ring-a" />
      <span className="badminton-shuttle-ring ring-b" />
      <span className="badminton-shuttle-band" />
      <span className="badminton-shuttle-cork" />
    </span>
  );
}
