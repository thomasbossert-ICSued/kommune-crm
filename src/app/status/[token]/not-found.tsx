export default function TokenNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F8F8] px-4">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-200">
          <span className="text-2xl">?</span>
        </div>
        <h1 className="text-xl font-bold text-[#1A1A2E]">Link ungültig</h1>
        <p className="mt-2 text-sm text-gray-500">
          Dieser Status-Link ist ungültig oder wurde deaktiviert.
        </p>
        <p className="mt-4 text-xs text-gray-400">
          Bei Fragen wende dich an deinen Berater.
        </p>
      </div>
    </div>
  )
}
