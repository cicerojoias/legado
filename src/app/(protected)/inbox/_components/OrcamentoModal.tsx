'use client'

import { useState, useEffect } from 'react'
import { X, ClipboardPaste } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Tipos de orçamento ────────────────────────────────────────────────────────

type OrcamentoType = 'banho-ouro' | 'alianca' | 'conserto' | 'formatura' | 'geral'

interface TypeConfig {
  id: OrcamentoType
  emoji: string
  label: string
  available: boolean
}

const TYPES: TypeConfig[] = [
  { id: 'banho-ouro', emoji: '🥇', label: 'Banho de Ouro',     available: true  },
  { id: 'alianca',    emoji: '💍', label: 'Aliança',            available: false },
  { id: 'conserto',   emoji: '🔧', label: 'Conserto',           available: false },
  { id: 'formatura',  emoji: '🎓', label: 'Formatura',          available: false },
  { id: 'geral',      emoji: '📝', label: 'Orçamento Geral',    available: false },
]

// ── Template helpers ──────────────────────────────────────────────────────────

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function calcParcela(valor: number): string {
  // Arredonda centavo para cima para que 6x * parcela >= valor à vista
  return fmtBRL(Math.ceil(valor / 6 * 100) / 100)
}

function buildBanhoOuro(peca: string, basico: number, inter: number, avanc: number): string {
  return `✨ *Banho de Ouro Premium - Cícero Joias*

💎 *Peça:* ${peca} (Modelo da Foto)

🥉 *Básico – 5 milésimos – sem garantia*
(R$ ${fmtBRL(basico)} à vista ou 6x de R$ ${calcParcela(basico)} sem juros)

🥈 *Intermediário – 10 milésimos – garantia de 6 meses*
(R$ ${fmtBRL(inter)} à vista ou 6x de R$ ${calcParcela(inter)} sem juros)

🥇 *Avançado – 20 milésimos – garantia de 1 ano*
(R$ ${fmtBRL(avanc)} à vista ou 6x de R$ ${calcParcela(avanc)} sem juros)

🧪 *Processo completo* com limpeza técnica, desengorduramento, preparação da peça e aplicação profissional das camadas para melhor fixação do ouro.

⏳ *Prazo de serviço:* até 14 dias úteis.

🔒 *Garantia:* refere-se exclusivamente a defeitos de aplicação do banho.
Não cobre mau uso, riscos, atritos constantes ou desgaste natural da camada.`
}

// ── Componente ────────────────────────────────────────────────────────────────

interface OrcamentoModalProps {
  open: boolean
  onClose: () => void
  onInsert: (text: string) => void
}

export function OrcamentoModal({ open, onClose, onInsert }: OrcamentoModalProps) {
  const [visible, setVisible] = useState(false)
  const [selectedType, setSelectedType] = useState<OrcamentoType>('banho-ouro')

  // Campos do Banho de Ouro
  const [peca, setPeca] = useState('')
  const [basico, setBasico] = useState('')
  const [inter, setInter] = useState('')
  const [avanc, setAvanc] = useState('')

  // Animação de entrada/saída
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else {
      setVisible(false)
    }
  }, [open])

  const basicoNum = parseFloat(basico) || 0
  const interNum  = parseFloat(inter)  || 0
  const avancNum  = parseFloat(avanc)  || 0

  const canConfirm = peca.trim().length > 0 && basicoNum > 0 && interNum > 0 && avancNum > 0

  const preview = canConfirm
    ? buildBanhoOuro(peca.trim(), basicoNum, interNum, avancNum)
    : null

  function handleConfirm() {
    if (!canConfirm || !preview) return
    onInsert(preview)
    onClose()
    // Reset após envio
    setPeca(''); setBasico(''); setInter(''); setAvanc('')
  }

  const priceFields = [
    { label: '🥉 Básico',        value: basico, set: setBasico, num: basicoNum },
    { label: '🥈 Intermediário', value: inter,  set: setInter,  num: interNum  },
    { label: '🥇 Avançado',      value: avanc,  set: setAvanc,  num: avancNum  },
  ]

  if (!open && !visible) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-[60] bg-black/60 transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-[61] flex flex-col rounded-t-2xl bg-background shadow-2xl',
          'transition-transform duration-300 ease-out max-h-[92dvh]',
          visible ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          <div>
            <h2 className="text-base font-semibold">Criar Orçamento</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Preencha e insira direto no chat</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="border-t shrink-0" />

        {/* Corpo com scroll */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

          {/* Seletor de tipo */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Tipo de orçamento
            </p>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => t.available && setSelectedType(t.id)}
                  disabled={!t.available}
                  className={cn(
                    'relative flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3.5 text-center transition-all',
                    // Último item ímpar ocupa linha inteira
                    i === TYPES.length - 1 && TYPES.length % 2 !== 0 && 'col-span-2',
                    t.available && selectedType === t.id
                      ? 'border-primary bg-primary/5 text-primary shadow-sm'
                      : t.available
                        ? 'border-border hover:bg-muted/50'
                        : 'border-border/40 opacity-40 cursor-not-allowed'
                  )}
                >
                  <span className="text-2xl leading-none">{t.emoji}</span>
                  <span className="text-[12px] font-medium leading-tight">{t.label}</span>
                  {!t.available && (
                    <span className="absolute -top-2 -right-2 text-[9px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 font-semibold border">
                      Em breve
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Formulário — Banho de Ouro */}
          {selectedType === 'banho-ouro' && (
            <div className="space-y-4 border-t pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Dados do orçamento
              </p>

              {/* Nome da peça */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nome da peça</label>
                <input
                  type="text"
                  value={peca}
                  onChange={(e) => setPeca(e.target.value)}
                  placeholder="Ex: Cordão, Aliança, Anel, Pingente..."
                  className="w-full rounded-xl border bg-muted/40 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
                />
              </div>

              {/* Valores com parcela calculada */}
              <div className="space-y-3">
                {priceFields.map(({ label, value, set, num }) => (
                  <div key={label} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">{label}</label>
                      {num > 0 && (
                        <span className="text-xs text-muted-foreground">
                          6x de R$ {calcParcela(num)}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
                        R$
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={value}
                        onChange={(e) => set(e.target.value)}
                        placeholder="0"
                        className="w-full rounded-xl border bg-muted/40 pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Prévia da mensagem */}
              {preview && (
                <div className="border-t pt-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Prévia da mensagem
                  </p>
                  <div className="rounded-xl bg-primary/5 border border-primary/15 px-4 py-3">
                    <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words font-sans text-foreground/80">
                      {preview}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t px-4 py-3 bg-background safe-area-bottom">
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={cn(
              'w-full flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold transition-all duration-150',
              canConfirm
                ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]'
                : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
            )}
          >
            <ClipboardPaste className="w-4 h-4" />
            Inserir no Chat
          </button>
        </div>
      </div>
    </>
  )
}
