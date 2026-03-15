'use client'

import { useState } from 'react'

export default function ClubJoinPage() {
  const [agreed, setAgreed] = useState(false)
  const [newsletter, setNewsletter] = useState(false)

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      {/* Header */}
      <div className="text-center mb-8">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl text-2xl font-bold mb-4"
          style={{ backgroundColor: '#00C4AA', color: '#fff' }}
        >
          👑
        </div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: '#1A1A2E' }}>
          הצטרף ל-Escape Club
        </h1>
        <p className="text-sm" style={{ color: '#6B7280' }}>
          הצטרף בחינם וקבל הטבות בכל ביקור
        </p>
      </div>

      {/* Benefits */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { icon: '👑', title: '₪15 הנחה', sub: 'לכל שחקן בכל משחק' },
          { icon: '🎁', title: '₪50 מתנה', sub: 'ביום ההולדת שלך' },
          { icon: '⭐', title: 'הצעות בלעדיות', sub: 'לחברי מועדון בלבד' },
        ].map((b) => (
          <div
            key={b.title}
            className="rounded-xl p-4 text-center"
            style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
          >
            <div className="text-2xl mb-2">{b.icon}</div>
            <div className="text-sm font-bold" style={{ color: '#1A1A2E' }}>
              {b.title}
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
              {b.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Form */}
      <div
        className="rounded-2xl p-6 space-y-4"
        style={{ border: '1px solid #E5E7EB', backgroundColor: '#fff' }}
      >
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="שם פרטי *"
            className="w-full px-4 py-3 rounded-lg text-sm"
            style={{
              border: '1px solid #E5E7EB',
              backgroundColor: '#F9FAFB',
              color: '#1A1A2E',
              outline: 'none',
            }}
          />
          <input
            type="text"
            placeholder="שם משפחה *"
            className="w-full px-4 py-3 rounded-lg text-sm"
            style={{
              border: '1px solid #E5E7EB',
              backgroundColor: '#F9FAFB',
              color: '#1A1A2E',
              outline: 'none',
            }}
          />
        </div>

        <input
          type="email"
          placeholder="אימייל *"
          className="w-full px-4 py-3 rounded-lg text-sm"
          style={{
            border: '1px solid #E5E7EB',
            backgroundColor: '#F9FAFB',
            color: '#1A1A2E',
            outline: 'none',
            direction: 'ltr',
          }}
        />

        <input
          type="tel"
          placeholder="פלאפון *"
          className="w-full px-4 py-3 rounded-lg text-sm"
          style={{
            border: '1px solid #E5E7EB',
            backgroundColor: '#F9FAFB',
            color: '#1A1A2E',
            outline: 'none',
            direction: 'ltr',
          }}
        />

        <input
          type="text"
          placeholder="תעודת זהות *"
          className="w-full px-4 py-3 rounded-lg text-sm"
          style={{
            border: '1px solid #E5E7EB',
            backgroundColor: '#F9FAFB',
            color: '#1A1A2E',
            outline: 'none',
            direction: 'ltr',
          }}
        />

        <div>
          <label className="block text-xs mb-1.5" style={{ color: '#6B7280' }}>
            תאריך לידה *
          </label>
          <input
            type="date"
            className="w-full px-4 py-3 rounded-lg text-sm"
            style={{
              border: '1px solid #E5E7EB',
              backgroundColor: '#F9FAFB',
              color: '#1A1A2E',
              outline: 'none',
            }}
          />
        </div>

        <select
          className="w-full px-4 py-3 rounded-lg text-sm"
          style={{
            border: '1px solid #E5E7EB',
            backgroundColor: '#F9FAFB',
            color: '#6B7280',
            outline: 'none',
          }}
        >
          <option value="">אזור מגורים</option>
          <option>תל אביב וגוש דן</option>
          <option>ירושלים</option>
          <option>חיפה והצפון</option>
          <option>באר שבע והדרום</option>
          <option>השרון</option>
          <option>אחר</option>
        </select>

        {/* Checkboxes */}
        <div className="space-y-3 pt-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 rounded"
            />
            <span className="text-sm" style={{ color: '#374151' }}>
              קראתי ומסכים ל
              <span className="underline cursor-pointer" style={{ color: '#00C4AA' }}>
                תנאי החברות
              </span>{' '}
              *
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={newsletter}
              onChange={(e) => setNewsletter(e.target.checked)}
              className="mt-0.5 rounded"
            />
            <span className="text-sm" style={{ color: '#374151' }}>
              הסכמה לקבלת עדכונים והצעות מיוחדות
            </span>
          </label>
        </div>

        <button
          disabled={!agreed}
          className="w-full py-4 rounded-xl font-bold text-base transition-all mt-2"
          style={{
            backgroundColor: agreed ? '#00C4AA' : '#D1D5DB',
            color: agreed ? '#fff' : '#9CA3AF',
            cursor: agreed ? 'pointer' : 'not-allowed',
          }}
        >
          הצטרף בחינם
        </button>
      </div>
    </div>
  )
}
