'use client'

import { useState } from 'react'

const ISRAELI_BANKS = [
  'בנק לאומי', 'בנק הפועלים', 'בנק דיסקונט', 'בנק מזרחי-טפחות',
  'בנק הבינלאומי', 'בנק ירושלים', 'בנק מרכנתיל דיסקונט', 'בנק יהב',
  'בנק אוצר החייל', 'בנק פועלי אגודת ישראל', 'One Zero', 'אחר',
]

interface BankAccount {
  id: string
  employeeName: string
  bankName: string
  branchNumber: string
  accountNumber: string
  accountHolder: string
}

const INITIAL_ACCOUNTS: BankAccount[] = [
  { id: '1', employeeName: 'דנה לוי', bankName: 'בנק לאומי', branchNumber: '800', accountNumber: '12345678', accountHolder: 'דנה לוי' },
  { id: '2', employeeName: 'יוסי כהן', bankName: 'בנק הפועלים', branchNumber: '512', accountNumber: '87654321', accountHolder: 'יוסף כהן' },
  { id: '3', employeeName: 'מירי שפירא', bankName: 'בנק דיסקונט', branchNumber: '222', accountNumber: '11223344', accountHolder: 'מרים שפירא' },
  { id: '4', employeeName: 'אבי גולן', bankName: 'בנק מזרחי-טפחות', branchNumber: '447', accountNumber: '99887766', accountHolder: 'אבי גולן' },
]

const BLANK: Omit<BankAccount, 'id'> = { employeeName: '', bankName: ISRAELI_BANKS[0], branchNumber: '', accountNumber: '', accountHolder: '' }

export default function PayrollBankPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>(INITIAL_ACCOUNTS)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<BankAccount>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<Omit<BankAccount, 'id'>>({ ...BLANK })
  const [saved, setSaved] = useState<string | null>(null)

  function startEdit(acc: BankAccount) {
    setEditing(acc.id)
    setDraft({ ...acc })
  }

  function saveEdit() {
    if (!editing) return
    setAccounts((prev) => prev.map((a) => (a.id === editing ? { ...a, ...draft } as BankAccount : a)))
    setSaved(editing)
    setTimeout(() => setSaved(null), 2000)
    setEditing(null)
    setDraft({})
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const newAcc: BankAccount = { id: String(Date.now()), ...addForm }
    setAccounts((prev) => [...prev, newAcc])
    setShowAdd(false)
    setAddForm({ ...BLANK })
  }

  function deleteAccount(id: string) {
    setAccounts((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#E8EAFF]">ניהול חשבונות בנק</h1>
          <p className="text-[#8B8FA8] text-sm mt-1">פרטי חשבון בנק לכל עובד להעברת משכורת</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: '#00C4AA', color: '#0F1117' }}
        >
          + הוסף חשבון
        </button>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2A2D3E' }}>
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#12141F', borderBottom: '1px solid #2A2D3E' }}>
              {['עובד', 'בנק', 'סניף', 'מספר חשבון', 'בעל החשבון', 'פעולות'].map((col) => (
                <th key={col} className="px-4 py-3 text-right text-xs font-semibold text-[#8B8FA8]">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accounts.map((acc, i) => {
              const isEditing = editing === acc.id
              const data = isEditing ? (draft as BankAccount) : acc
              return (
                <tr
                  key={acc.id}
                  style={{
                    background: saved === acc.id ? 'rgba(0,196,170,0.05)' : i % 2 === 0 ? '#1A1D27' : '#171A26',
                    borderBottom: i < accounts.length - 1 ? '1px solid #2A2D3E' : 'none',
                  }}
                >
                  <td className="px-4 py-3 text-[#E8EAFF] font-medium">{acc.employeeName}</td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <select
                        value={data.bankName}
                        onChange={(e) => setDraft({ ...draft, bankName: e.target.value })}
                        className="rounded px-2 py-1 outline-none text-sm w-full"
                        style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
                      >
                        {ISRAELI_BANKS.map((b) => <option key={b}>{b}</option>)}
                      </select>
                    ) : (
                      <span className="text-[#8B8FA8]">{acc.bankName}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={data.branchNumber}
                        onChange={(e) => setDraft({ ...draft, branchNumber: e.target.value })}
                        className="w-24 rounded px-2 py-1 outline-none text-sm font-numbers"
                        style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
                      />
                    ) : (
                      <span className="text-[#8B8FA8] font-numbers">{acc.branchNumber}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={data.accountNumber}
                        onChange={(e) => setDraft({ ...draft, accountNumber: e.target.value })}
                        className="w-36 rounded px-2 py-1 outline-none text-sm font-numbers"
                        style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
                      />
                    ) : (
                      <span className="text-[#E8EAFF] font-numbers">{acc.accountNumber}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={data.accountHolder}
                        onChange={(e) => setDraft({ ...draft, accountHolder: e.target.value })}
                        className="w-32 rounded px-2 py-1 outline-none text-sm"
                        style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
                      />
                    ) : (
                      <span className="text-[#8B8FA8]">{acc.accountHolder}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <button onClick={saveEdit} className="text-xs px-2 py-1 rounded font-bold" style={{ background: '#00C4AA', color: '#0F1117' }}>שמור</button>
                          <button onClick={() => { setEditing(null); setDraft({}) }} className="text-xs px-2 py-1 rounded" style={{ background: '#2A2D3E', color: '#8B8FA8' }}>ביטול</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(acc)} className="text-xs px-2 py-1 rounded" style={{ background: '#2A2D3E', color: '#8B8FA8' }}>✏</button>
                          <button onClick={() => deleteAccount(acc.id)} className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171' }}>✕</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Add account modal */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setShowAdd(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6"
            style={{ background: '#1A1D27', border: '1px solid #2A2D3E' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-[#E8EAFF] mb-4">הוספת חשבון בנק</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              {[
                { label: 'שם עובד', field: 'employeeName' as const, type: 'text' },
                { label: 'מספר סניף', field: 'branchNumber' as const, type: 'text' },
                { label: 'מספר חשבון', field: 'accountNumber' as const, type: 'text' },
                { label: 'שם בעל החשבון', field: 'accountHolder' as const, type: 'text' },
              ].map(({ label, field, type }) => (
                <div key={field}>
                  <label className="block text-xs text-[#8B8FA8] mb-1">{label}</label>
                  <input
                    type={type}
                    value={addForm[field]}
                    onChange={(e) => setAddForm({ ...addForm, [field]: e.target.value })}
                    required
                    className="w-full rounded-lg px-3 py-2 outline-none text-sm"
                    style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs text-[#8B8FA8] mb-1">בנק</label>
                <select
                  value={addForm.bankName}
                  onChange={(e) => setAddForm({ ...addForm, bankName: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 outline-none text-sm"
                  style={{ background: '#0F1117', border: '1px solid #2A2D3E', color: '#E8EAFF' }}
                >
                  {ISRAELI_BANKS.map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: '#00C4AA', color: '#0F1117' }}>שמור</button>
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl text-sm" style={{ background: '#2A2D3E', color: '#8B8FA8' }}>ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
