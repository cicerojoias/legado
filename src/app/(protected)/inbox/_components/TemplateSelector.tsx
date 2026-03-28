'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Send, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { WA_TEMPLATES, type WaTemplateConfig } from '@/lib/whatsapp/templates'

interface TemplateSelectorProps {
  conversationId: string
  onMessageSent?: () => void
}

export function TemplateSelector({ conversationId, onMessageSent }: TemplateSelectorProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [paramValues, setParamValues] = useState<Record<string, string[]>>({})
  const [sending, setSending] = useState(false)

  function getValues(template: WaTemplateConfig): string[] {
    return paramValues[template.name] ?? template.params.map(() => '')
  }

  function setParamAt(template: WaTemplateConfig, index: number, value: string) {
    const current = getValues(template)
    const updated = [...current]
    updated[index] = value
    setParamValues((prev) => ({ ...prev, [template.name]: updated }))
  }

  function getPreview(template: WaTemplateConfig): string {
    let preview = template.preview
    getValues(template).forEach((val, i) => {
      preview = preview.replace(`{{${i + 1}}}`, val || `{{${i + 1}}}`)
    })
    return preview
  }

  async function handleSend(template: WaTemplateConfig) {
    const values = getValues(template)
    const allFilled = template.params.every((_, i) => values[i]?.trim())
    if (!allFilled) {
      toast.error('Preencha todos os campos antes de enviar.')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/whatsapp/send-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          templateName: template.name,
          params: values.map((v) => v.trim()),
        }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}))
        throw new Error(error ?? 'Erro ao enviar template.')
      }
      toast.success('Template enviado!')
      setExpanded(null)
      setParamValues((prev) => ({
        ...prev,
        [template.name]: template.params.map(() => ''),
      }))
      onMessageSent?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar template.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="border-t bg-background px-4 py-3">
      {/* Aviso de janela expirada */}
      <div className="flex items-center gap-1.5 mb-3">
        <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <p className="text-xs text-amber-600 font-medium">
          Janela de 24h expirada — escolha um template para reabrir a conversa
        </p>
      </div>

      <div className="space-y-2">
        {WA_TEMPLATES.map((template) => {
          const isOpen = expanded === template.name
          const values = getValues(template)
          const canSend = template.params.every((_, i) => values[i]?.trim())

          return (
            <div key={template.name} className="border rounded-xl overflow-hidden">
              {/* Cabeçalho do template */}
              <button
                onClick={() => setExpanded(isOpen ? null : template.name)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left hover:bg-muted/40 transition-colors"
              >
                <span className="font-medium">{template.displayName}</span>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </button>

              {/* Painel expandido */}
              {isOpen && (
                <div className="px-3 pb-3 border-t bg-muted/20 space-y-2">
                  {template.params.map((param, i) => (
                    <div key={i} className="mt-2">
                      <label className="text-xs text-muted-foreground block mb-1">
                        {param.label}
                      </label>
                      <input
                        type="text"
                        placeholder={param.placeholder}
                        value={values[i] ?? ''}
                        onChange={(e) => setParamAt(template, i, e.target.value)}
                        className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  ))}

                  {/* Preview interpolado */}
                  <div className="mt-2 rounded-lg bg-primary/10 px-3 py-2 text-xs text-muted-foreground italic leading-relaxed">
                    {getPreview(template)}
                  </div>

                  <button
                    onClick={() => handleSend(template)}
                    disabled={sending || !canSend}
                    className="mt-1 w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium disabled:opacity-40 transition-opacity active:scale-[.99] cursor-pointer hover:bg-primary/90"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {sending ? 'Enviando...' : 'Enviar Template'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
