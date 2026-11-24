export function LoadingState({ label = 'Loading...', fullScreen = false }: { label?: string; fullScreen?: boolean }) {
  return (
    <div className="state" style={fullScreen ? { minHeight: '100vh' } : undefined} role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <p className="state__text">{label}</p>
    </div>
  );
}

export function SkeletonBlock({ height = 16, width = '100%', radius }: { height?: number; width?: number | string; radius?: number }) {
  return <div className="skeleton" style={{ height, width, borderRadius: radius }} aria-hidden="true" />;
}
