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
  { id: 'alianca',    emoji: '💍', label: 'Aliança',            available: true  },
  { id: 'conserto',   emoji: '🔧', label: 'Conserto',           available: false },
  { id: 'formatura',  emoji: '🎓', label: 'Formatura',          available: true  },
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

function buildFormatura(valor: number): string {
  const parcela = fmtBRL(Math.ceil(valor / 10 * 100) / 100)
  return `Nesse modelo em ouro 16k fica por R$ ${fmtBRL(valor)}. Feito sob medida exclusivamente para você.

• Prazo de fabricação: até 14 dias (pode variar) ⏳
• Opcional de símbolo em prata ⚖️
• Acompanha caixinha 🎁
• Qualidade e preço de fábrica 🏭
• Não quebra, feitas sem emenda 🔗
• Dividimos em até 10x sem juros (10x de R$ ${parcela}) 💳

Se precisar de mais modelos ou quiser tirar dúvidas, estou à disposição! 😁`
}

type MaterialType = 'prata990' | 'ouro16k' | 'ouro18k'

interface AliancaMaterial {
  tipo: MaterialType
  valor: number
}

function buildAlianca(
  materiais: AliancaMaterial[],
  largura: string,
  temFoto: boolean
): string {
  const materiaisOrdenados = materiais.sort((a, b) => {
    const ordem = { prata990: 0, ouro16k: 1, ouro18k: 2 }
    return ordem[a.tipo] - ordem[b.tipo]
  })

  const larguraTexto = temFoto ? 'conforme foto de referência 📸' : `${largura}mm`

  let mensagem = `💍 *Orçamento – Par de Alianças ${larguraTexto}*\n\n`

  materiaisOrdenados.forEach((material, index) => {
    const valorParcela = fmtBRL(Math.ceil(material.valor / 6 * 100) / 100)

    switch (material.tipo) {
      case 'ouro18k':
        mensagem += `🔸 *Ouro 18k (750)*\n`
        mensagem += `💰 R$ ${fmtBRL(material.valor)} o par\n`
        mensagem += `💳 6x de R$ ${valorParcela} sem juros\n`
        mensagem += `🔒 Garantia eterna do ouro\n\n`
        break
      case 'ouro16k':
        mensagem += `🔸 *Ouro 16k*\n`
        mensagem += `💰 R$ ${fmtBRL(material.valor)} o par\n`
        mensagem += `💳 6x de R$ ${valorParcela} sem juros\n`
        mensagem += `🔒 Garantia eterna do ouro\n\n`
        break
      case 'prata990':
        mensagem += `🔸 *Prata 990*\n`
        mensagem += `💰 R$ ${fmtBRL(material.valor)} o par\n`
        mensagem += `💳 6x de R$ ${valorParcela} sem juros\n`
        mensagem += `🔒 Garantia eterna\n\n`
        break
    }
  })

  mensagem += `🏭 *Preço de fábrica*\n\n`
  mensagem += `📏 Fabricadas exclusivamente no tamanho do seu dedo\n\n`
  mensagem += `🛠️ Feitas *sem emendas*\n`
  mensagem += `• Peça inteiriça\n`
  mensagem += `• Não utilizamos solda\n`
  mensagem += `• Muito mais resistência e durabilidade\n\n`
  mensagem += `🎁 Acompanha caixinha de veludo\n\n`
  mensagem += `✍️ Gravação interna gratuita (nomes e data, se desejar)\n\n`
  mensagem += `O peso pode variar levemente conforme as numerações.\n`
  mensagem += `Me informe os números dos aros que já confirmo tudo certinho. 💛`

  return mensagem
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

  // Campos de Formatura
  const [valorFormatura, setValorFormatura] = useState('')

  // Campos de Aliança
  const [materiaisSelecionados, setMateriaisSelecionados] = useState<Set<MaterialType>>(new Set())
  const [valorPrata, setValorPrata] = useState('')
  const [valorOuro16k, setValorOuro16k] = useState('')
  const [valorOuro18k, setValorOuro18k] = useState('')
  const [larguraAlianca, setLarguraAlianca] = useState('')
  const [aliancaTemFoto, setAliancaTemFoto] = useState(false)

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
  const valorFormaturaNum = parseFloat(valorFormatura) || 0
  const valorPrataNum = parseFloat(valorPrata) || 0
  const valorOuro16kNum = parseFloat(valorOuro16k) || 0
  const valorOuro18kNum = parseFloat(valorOuro18k) || 0

  const canConfirm =
    selectedType === 'banho-ouro'
      ? peca.trim().length > 0 && basicoNum > 0 && interNum > 0 && avancNum > 0
      : selectedType === 'formatura'
        ? valorFormaturaNum > 0
        : selectedType === 'alianca'
          ? materiaisSelecionados.size > 0 && (
              (!materiaisSelecionados.has('prata990') || valorPrataNum > 0) &&
              (!materiaisSelecionados.has('ouro16k') || valorOuro16kNum > 0) &&
              (!materiaisSelecionados.has('ouro18k') || valorOuro18kNum > 0)
            ) && (aliancaTemFoto || larguraAlianca.trim().length > 0)
          : false

  const preview = canConfirm
    ? selectedType === 'banho-ouro'
      ? buildBanhoOuro(peca.trim(), basicoNum, interNum, avancNum)
      : selectedType === 'formatura'
        ? buildFormatura(valorFormaturaNum)
        : selectedType === 'alianca'
          ? buildAlianca(
              materiaisSelecionados.size > 0
                ? [
                    ...(materiaisSelecionados.has('prata990') ? [{ tipo: 'prata990' as MaterialType, valor: valorPrataNum }] : []),
                    ...(materiaisSelecionados.has('ouro16k') ? [{ tipo: 'ouro16k' as MaterialType, valor: valorOuro16kNum }] : []),
                    ...(materiaisSelecionados.has('ouro18k') ? [{ tipo: 'ouro18k' as MaterialType, valor: valorOuro18kNum }] : []),
                  ]
                : [],
              larguraAlianca,
              aliancaTemFoto
            )
          : null
    : null

  function handleConfirm() {
    if (!canConfirm || !preview) return
    onInsert(preview)
    onClose()
    // Reset após envio
    setPeca(''); setBasico(''); setInter(''); setAvanc('')
    setValorFormatura('')
    setMateriaisSelecionados(new Set())
    setValorPrata(''); setValorOuro16k(''); setValorOuro18k('')
    setLarguraAlianca(''); setAliancaTemFoto(false)
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

          {/* Formulário — Formatura */}
          {selectedType === 'formatura' && (
            <div className="space-y-4 border-t pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Dados do orçamento
              </p>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Valor total</label>
                  {valorFormaturaNum > 0 && (
                    <span className="text-xs text-muted-foreground">
                      10x de R$ {fmtBRL(Math.ceil(valorFormaturaNum / 10 * 100) / 100)}
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
                    value={valorFormatura}
                    onChange={(e) => setValorFormatura(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border bg-muted/40 pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

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

          {/* Formulário — Aliança */}
          {selectedType === 'alianca' && (
            <div className="space-y-4 border-t pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Materiais desejados
              </p>

              {/* Seleção de materiais */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'prata990' as MaterialType, label: 'Prata 990', emoji: '🥈' },
                  { id: 'ouro16k' as MaterialType, label: 'Ouro 16k', emoji: '🔸' },
                  { id: 'ouro18k' as MaterialType, label: 'Ouro 18k', emoji: '✨' },
                ].map((mat) => {
                  const isSelected = materiaisSelecionados.has(mat.id)
                  return (
                    <button
                      key={mat.id}
                      onClick={() => {
                        const novos = new Set(materiaisSelecionados)
                        if (novos.has(mat.id)) {
                          novos.delete(mat.id)
                        } else {
                          novos.add(mat.id)
                        }
                        setMateriaisSelecionados(novos)
                      }}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 transition-all',
                        isSelected
                          ? 'border-primary bg-primary/5 text-primary shadow-sm'
                          : 'border-border hover:bg-muted/50'
                      )}
                    >
                      <span className="text-xl leading-none">{mat.emoji}</span>
                      <span className="text-[11px] font-medium leading-tight">{mat.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Valores por material */}
              {materiaisSelecionados.size > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Valores por material
                  </p>

                  {materiaisSelecionados.has('prata990') && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">🥈 Prata 990</label>
                        {valorPrataNum > 0 && (
                          <span className="text-xs text-muted-foreground">
                            6x de R$ {fmtBRL(Math.ceil(valorPrataNum / 6 * 100) / 100)}
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
                          value={valorPrata}
                          onChange={(e) => setValorPrata(e.target.value)}
                          placeholder="0"
                          className="w-full rounded-xl border bg-muted/40 pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    </div>
                  )}

                  {materiaisSelecionados.has('ouro16k') && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">🔸 Ouro 16k</label>
                        {valorOuro16kNum > 0 && (
                          <span className="text-xs text-muted-foreground">
                            6x de R$ {fmtBRL(Math.ceil(valorOuro16kNum / 6 * 100) / 100)}
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
                          value={valorOuro16k}
                          onChange={(e) => setValorOuro16k(e.target.value)}
                          placeholder="0"
                          className="w-full rounded-xl border bg-muted/40 pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    </div>
                  )}

                  {materiaisSelecionados.has('ouro18k') && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">✨ Ouro 18k (750)</label>
                        {valorOuro18kNum > 0 && (
                          <span className="text-xs text-muted-foreground">
                            6x de R$ {fmtBRL(Math.ceil(valorOuro18kNum / 6 * 100) / 100)}
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
                          value={valorOuro18k}
                          onChange={(e) => setValorOuro18k(e.target.value)}
                          placeholder="0"
                          className="w-full rounded-xl border bg-muted/40 pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Largura da aliança */}
              {materiaisSelecionados.size > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Largura / Espessura
                  </p>

                  {/* Toggle: Digitar largura ou Conforme foto */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAliancaTemFoto(false)}
                      className={cn(
                        'flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all',
                        !aliancaTemFoto
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border hover:bg-muted/50'
                      )}
                    >
                      📏 Digitar largura
                    </button>
                    <button
                      onClick={() => setAliancaTemFoto(true)}
                      className={cn(
                        'flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all',
                        aliancaTemFoto
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border hover:bg-muted/50'
                      )}
                    >
                      📸 Conforme foto
                    </button>
                  </div>

                  {!aliancaTemFoto && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Largura (mm)</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        step="0.5"
                        value={larguraAlianca}
                        onChange={(e) => setLarguraAlianca(e.target.value)}
                        placeholder="Ex: 5"
                        className="w-full rounded-xl border bg-muted/40 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <p className="text-xs text-muted-foreground">
                        Informe a largura em milímetros (ex: 5mm)
                      </p>
                    </div>
                  )}

                  {aliancaTemFoto && (
                    <div className="rounded-xl bg-muted/30 border border-border px-4 py-3">
                      <p className="text-sm text-muted-foreground">
                        📸 A largura será definida conforme a foto de referência enviada pelo cliente.
                      </p>
                    </div>
                  )}
                </div>
              )}

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
