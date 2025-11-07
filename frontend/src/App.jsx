import React, { useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function App() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setError('')
    setResult(null)

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch(`${API_BASE}/api/process`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        let errorMsg = 'Request failed'
        try {
          const errorData = await res.json()
          errorMsg = errorData.error || errorData.details || errorData.message || errorMsg
        } catch {
          try {
            const errorText = await res.text()
            errorMsg = errorText || errorMsg
          } catch {
            errorMsg = `Server error: ${res.status} ${res.statusText}`
          }
        }
        throw new Error(errorMsg)
      }
      const data = await res.json()
      setResult(data)
    } catch (err) {
      let errorMessage = 'Request failed'
      if (err instanceof TypeError && err.message.includes('fetch')) {
        errorMessage = `Network error: Unable to connect to backend at ${API_BASE}. Please check if the backend is running.`
      } else if (err.message) {
        errorMessage = err.message
      } else if (err instanceof Error) {
        errorMessage = err.toString()
      }
      console.error('Upload error:', err)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">AI Study Notes</h1>
        <p className="text-gray-600">Upload audio/video to transcribe and generate study materials via Ollama.</p>
      </header>

      <form onSubmit={onSubmit} className="bg-white border rounded-lg p-4 flex items-center gap-4">
        <input
          type="file"
          accept="audio/*,video/*,.mp3,.mp4,.m4a,.wav,.mov,.webm"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
        />
        <button
          type="submit"
          disabled={!file || loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md disabled:opacity-50"
        >
          {loading ? 'Processing…' : 'Upload & Process'}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 rounded-md bg-red-50 text-red-700 border border-red-200">{error}</div>
      )}

      {result && (
        <div className="mt-6 grid grid-cols-1 gap-6">
          <section className="bg-white border rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-2">Transcript</h2>
            <pre className="whitespace-pre-wrap text-sm text-gray-800">{result.transcript}</pre>
          </section>

          <section className="bg-white border rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-2">Summary</h2>
            <pre className="whitespace-pre-wrap text-sm text-gray-800">{result.summary}</pre>
          </section>

          <section className="bg-white border rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-2">Notes</h2>
            <pre className="whitespace-pre-wrap text-sm text-gray-800">{result.notes}</pre>
          </section>

          <section className="bg-white border rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-2">Study Plan</h2>
            <pre className="whitespace-pre-wrap text-sm text-gray-800">{result.studyPlan}</pre>
          </section>
        </div>
      )}
    </div>
  )
}
