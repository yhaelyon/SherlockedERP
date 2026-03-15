// ============================================================
// Shared TypeScript Types — Sherlocked ERP
// /packages/shared/src/types/index.ts
// ============================================================

// ─── Enums ───────────────────────────────────────────────────

export type UserRole        = 'staff' | 'shift_lead' | 'manager' | 'admin';
export type EmploymentType  = 'hourly' | 'global';
export type SlotStatus      = 'available' | 'pending' | 'booked' | 'blocked' | 'cancelled';
export type BookingStatus   = 'pending' | 'confirmed' | 'cancelled' | 'no_show';
export type PaymentMethod   = 'card' | 'cash' | 'voucher' | 'credit' | 'other';
export type PaymentStatus   = 'pending' | 'paid' | 'failed' | 'refunded' | 'partial_refund';
export type VoucherStatus   = 'active' | 'used' | 'expired' | 'cancelled';
export type ShiftType       = 'morning' | 'evening';
export type ClubStatus      = 'active' | 'inactive';
export type PayrollStatus   = 'draft' | 'approved' | 'paid';
export type HolidayType     = 'holiday' | 'special';
export type WaStatus        = 'connected' | 'disconnected' | 'qr_required' | 'connecting';
export type WaMessageStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'cancelled';

// ─── Core entities ───────────────────────────────────────────

export interface Branch {
  id:         string;
  name:       string;
  address:    string | null;
  wifi_ssid:  string;
  timezone:   string;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id:            string;
  branch_id:     string;
  name:          string;
  capacity_min:  number;
  capacity_max:  number;
  color_hex:     string;
  display_order: number;
  is_mythos:     boolean;  // VIP — no discounts allowed
  age_min:       number;
  status:        'active' | 'inactive';
  slug:          string | null;
  created_at:    string;
  updated_at:    string;
}

export interface Slot {
  id:                  string;
  room_id:             string;
  start_at:            string;  // ISO 8601
  end_at:              string;
  status:              SlotStatus;
  block_expires_at:    string | null;
  blocked_by_session:  string | null;
  note:                string | null;
}

export interface Customer {
  id:                string;
  phone:             string;
  first_name:        string;
  last_name:         string | null;
  email:             string | null;
  referral_source:   string | null;
  escape_experience: string | null;
  notes:             string | null;
  consent_marketing: boolean;
  created_at:        string;
  escape_club?:      EscapeClubMember;  // joined
}

export interface EscapeClubMember {
  customer_id:           string;
  id_number:             string;
  dob:                   string;  // ISO date
  area:                  string | null;
  member_since:          string;
  status:                ClubStatus;
  discount_per_person:   number;  // ₪15
  birthday_gift_amount:  number;  // ₪50
}

export interface Booking {
  id:                        string;
  branch_id:                 string;
  room_id:                   string;
  slot_id:                   string;
  customer_id:               string;
  participants_count:        number;
  is_club_member:            boolean;
  price_regular:             number;
  price_member:              number | null;
  price_total:               number;
  amount_paid:               number;
  discount_total:            number;
  discount_breakdown_json:   DiscountBreakdown;
  voucher_code:              string | null;
  voucher_amount:            number | null;
  cancellation_policy_applied: string | null;
  cancellation_fee:          number | null;
  status:                    BookingStatus;
  notes:                     string | null;
  internal_notes:            string | null;
  terms_accepted:            boolean;
  terms_accepted_at:         string | null;
  created_by:                string | null;
  created_at:                string;
  updated_at:                string;
  // joined
  room?:                     Room;
  slot?:                     Slot;
  customer?:                 Customer;
  payments?:                 Payment[];
}

export interface DiscountBreakdown {
  club?:     number;
  military?: number;
  student?:  number;
  family?:   number;
  children?: number;
  special?:  number;
  voucher?:  number;
}

export interface Payment {
  id:                       string;
  booking_id:               string;
  payplus_transaction_id:   string | null;
  payplus_payment_page_id:  string | null;
  amount:                   number;
  method:                   PaymentMethod;
  status:                   PaymentStatus;
  refund_amount:            number | null;
  paid_at:                  string | null;
  created_at:               string;
}

export interface GiftVoucher {
  id:                    string;
  code:                  string;
  type_id:               string | null;
  price:                 number;
  remaining_amount:      number;
  purchaser_name:        string;
  purchaser_phone:       string | null;
  recipient_name:        string | null;
  status:                VoucherStatus;
  expires_at:            string | null;
  used_in_booking_id:    string | null;
  used_at:               string | null;
}

// ─── Pricing ─────────────────────────────────────────────────

export const REGULAR_PRICING: Record<number, number> = {
  2: 300, 3: 420, 4: 520, 5: 600, 6: 720,
  7: 840, 8: 960, 9: 1080, 10: 1200,
};
export const REGULAR_EXTRA_PER_PERSON = 120;

export const MYTHOS_PRICING: Record<number, number> = {
  2: 400, 3: 450, 4: 560, 5: 650, 6: 780, 7: 910, 8: 1040,
};
export const MYTHOS_EXTRA_PER_PERSON = 130;

export const CLUB_DISCOUNT_PER_PERSON = 15; // ₪15
export const BIRTHDAY_GIFT_AMOUNT     = 50; // ₪50
export const DISCOUNT_MILITARY        = 10; // ₪10 per person
export const DISCOUNT_STUDENT         = 10; // ₪10 per person
export const DISCOUNT_FAMILY_WEEKDAY  = 100; // ₪100 flat
export const DISCOUNT_CHILDREN_PCT    = 20; // 20% per child under 12

export function getRegularPrice(participants: number): number {
  if (participants <= 0) return 0;
  if (participants <= 10) return REGULAR_PRICING[participants] ?? 0;
  return (REGULAR_PRICING[10] ?? 1200) + (participants - 10) * REGULAR_EXTRA_PER_PERSON;
}

export function getMythosPrice(participants: number): number {
  if (participants <= 0) return 0;
  if (participants <= 8) return MYTHOS_PRICING[participants] ?? 0;
  return (MYTHOS_PRICING[8] ?? 1040) + (participants - 8) * MYTHOS_EXTRA_PER_PERSON;
}

export function getMemberPrice(participants: number): number {
  return getRegularPrice(participants) - (participants * CLUB_DISCOUNT_PER_PERSON);
}

// ─── Slots ────────────────────────────────────────────────────

export const SLOT_DURATION_MIN  = 60;
export const SLOT_INTERVAL_MIN  = 90;  // 60 game + 30 buffer
export const SLOT_HOLD_MINUTES  = 5;

// ─── Employees ─────────────────────────────────────────────────

export interface UserProfile {
  id:                       string;
  role:                     UserRole;
  branch_id:                string | null;
  full_name:                string;
  id_number:                string | null;
  phone:                    string | null;
  hourly_rate:              number | null;
  employment_type:          EmploymentType;
  global_monthly_salary:    number | null;
  travel_per_shift:         number | null;
  max_travel_monthly:       number | null;
  overtime_eligible:        boolean;
  vacation_pay_eligible:    boolean;
  monthly_health_eligible:  boolean;
  monthly_health_amount:    number | null;
  active:                   boolean;
}

export interface AttendanceLog {
  id:                   string;
  user_id:              string;
  branch_id:            string;
  clock_in:             string;
  clock_out:            string | null;
  total_minutes:        number | null;
  wifi_token_verified:  boolean;
  manual_entry:         boolean;
  note:                 string | null;
}

export interface ShiftAssignment {
  id:           string;
  user_id:      string;
  branch_id:    string;
  date:         string;
  shift_type:   ShiftType;
  order_number: number;
  note:         string | null;
}

export interface PayrollPeriod {
  id:             string;
  user_id:        string;
  period_start:   string;
  period_end:     string;
  hours_100:      number;
  hours_125:      number;
  hours_150:      number;
  hours_175:      number;
  hours_200:      number;
  hours_shabbat:  number;
  work_days:      number;
  travel_total:   number;
  bonus:          number;
  vacation_pay:   number;
  monthly_health: number;
  total_salary:   number;
  status:         PayrollStatus;
}

// ─── Cancellation ─────────────────────────────────────────────

export function calculateCancellationFee(
  priceTotal: number,
  gameStartISO: string,
  cancelledAt?: Date,
): { fee: number; pct: number; label: string } {
  const gameStart  = new Date(gameStartISO);
  const cancelTime = cancelledAt ?? new Date();
  const hoursUntil = (gameStart.getTime() - cancelTime.getTime()) / (1000 * 60 * 60);

  if (hoursUntil >= 24) {
    return { fee: 0,              pct: 0,   label: 'ללא חיוב' };
  } else if (hoursUntil >= 2) {
    return { fee: priceTotal * 0.5, pct: 50, label: 'חיוב 50%' };
  } else {
    return { fee: priceTotal,     pct: 100, label: 'חיוב מלא 100%' };
  }
}

export function isVoucherForfeit(gameStartISO: string, status?: BookingStatus): boolean {
  const gameStart  = new Date(gameStartISO);
  const hoursUntil = (gameStart.getTime() - Date.now()) / (1000 * 60 * 60);
  return hoursUntil < 24 || status === 'no_show';
}

// ─── Date & formatting helpers ───────────────────────────────

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatSlot(startISO: string, endISO: string): string {
  return `${formatTime(startISO)} - ${formatTime(endISO)}`;
}

export function formatCurrency(amount: number): string {
  return `₪${amount.toLocaleString('he-IL')}`;
}
