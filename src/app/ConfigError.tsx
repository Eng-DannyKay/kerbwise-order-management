interface ConfigErrorProps {
  missing: string[]
}

/** Shown instead of the app when required settings are missing, so setup problems are visible on screen. */
export function ConfigError({ missing }: ConfigErrorProps) {
  return (
    <main className="mx-auto max-w-xl px-4 py-12 text-sm">
      <div role="alert" className="rounded-card border border-danger-700/30 bg-white p-6 shadow-card">
        <h1 className="text-xl font-bold tracking-tight">The order desk isn’t set up yet</h1>
        <p className="mt-2 text-muted">These settings are missing:</p>
        <ul className="mt-1 list-disc pl-5 font-mono">
          {missing.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
        <p className="mt-3 text-muted">
          Add them to a <code className="font-mono">.env</code> file in the project folder, as described in the README,
          then restart the development server.
        </p>
      </div>
    </main>
  )
}
