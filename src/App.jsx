import { useEffect, useState } from 'react'
import { supabase } from './supabase'

function App() {
  const [status, setStatus] = useState('Testing connection...')

  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase.from('players').select('count')
      if (error) {
        setStatus('❌ Connection failed: ' + error.message)
      } else {
        setStatus('✅ Connected to Supabase successfully!')
      }
    }
    testConnection()
  }, [])

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', fontSize: '20px' }}>
      <h1>Snook Buzz</h1>
      <p>{status}</p>
    </div>
  )
}

export default App