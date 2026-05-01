'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Send, ChevronDown, ChevronUp, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { WA_TEMPLATES, type WaTemplateConfig } from '@/lib/whatsapp/templates'

interface TemplateSelectorProps {
  conversationId: string
  onMessageSent?: () => void
}

interface TemplateStatus {
  name: string
  isValid: boolean
  isLoading: boolean
  error?: string
}

export function TemplateSelector({ conversationId, onMessageSent }: TemplateSelectorProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [paramValues, setParamValues] = useState<Record<string, string[]>>({})
  const [sending, setSending] = useState(false)
  const [templateStatuses, setTemplateStatuses] = useState<Record<string, TemplateStatus>>({})

  // Validar todos os templates ao montar o componente
  useEffect(() => {
    const validateAll = async () => {
      const statuses: Record<string, TemplateStatus> = {}
      
      for (const template of WA_TEMPLATES) {
        statuses[template.name] = { name: template.name, isValid: false, isLoading: true }
      }
      setTemplateStatuses(statuses)

      // Validar em paralelo
      const results = await Promise.allSettled(
        WA_TEMPLATES.map(async (template) => {
          try {
            const res = await fetch('/api/whatsapp/validate-template', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                templateName: template.name,
                languageCode: template.language,
              }),
            })
            const data = await res.json()
            return { name: template.name, isValid: data.isValid, error: data.error }
          } catch (err) {
            return { name: template.name, isValid: false, error: 'Erro na validação' }
          }
        })
      )

      const newStatuses: Record<string, TemplateStatus> = {}
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const r = result.value
          newStatuses[r.name] = {
            name: r.name,
            isValid: r.isValid,
            isLoading: false,
            error: r.error,
          }
        }
      })
      setTemplateStatuses(newStatuses)
    }

    validateAll()
  }, [])

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
      
      const data = await res.json()
      
      if (!res.ok) {
        // Mostrar erro detalhado para o usuário
        const errorMessage = data.details || data.error || 'Erro ao enviar template.'
        toast.error(errorMessage)
        
        // Se o erro for de template não aprovado, dar instrução clara
        if (data.details?.includes('aprovado pela Meta')) {
          toast.error(
            'Template não aprovado! Acesse o Meta Business Manager > WhatsApp > Gerenciador de Modelos e verifique o status.',
            { duration: 8000 }
          )
        }
        
        throw new Error(data.error ?? 'Erro ao enviar template.')
      }
      
      toast.success('Template enviado com sucesso!')
      setExpanded(null)
      setParamValues((prev) => ({
        ...prev,
        [template.name]: template.params.map(() => ''),
      }))
      onMessageSent?.()
    } catch (err) {
      // Erro já foi tratado acima
      if (!(err instanceof Error && err.message.includes('Meta'))) {
        toast.error(err instanceof Error ? err.message : 'Erro ao enviar template.')
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="border-t bg-background px-4 py-3">
      {/* Aviso de janela expirada */}
      <div className="flex items-start gap-1.5 mb-3">
        <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs text-amber-600 font-medium">
            Janela de 24h expirada — escolha um template para reabrir a conversa
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            O cliente precisa responder para continuarmos o atendimento.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {WA_TEMPLATES.map((template) => {
          const isOpen = expanded === template.name
          const values = getValues(template)
          const canSend = template.params.every((_, i) => values[i]?.trim())
          const status = templateStatuses[template.name]
          const isTemplateValid = status?.isValid ?? true // Assume válido se ainda não validou
          const isLoading = status?.isLoading ?? false

          return (
            <div key={template.name} className="border rounded-xl overflow-hidden">
              {/* Cabeçalho do template */}
              <button
                onClick={() => setExpanded(isOpen ? null : template.name)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left hover:bg-muted/40 transition-colors"
                disabled={isLoading}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* Indicador de status */}
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin shrink-0" />
                  ) : isTemplateValid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                  )}
                  
                  <span className="font-medium truncate">{template.displayName}</span>
                  
                  {/* Tooltip de erro se inválido */}
                  {!isTemplateValid && status?.error && (
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  )}
                </div>
                
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
                )}
              </button>

              {/* Painel expandido */}
              {isOpen && (
                <div className="px-3 pb-3 border-t bg-muted/20 space-y-2">
                  {/* Alerta se template não está válido */}
                  {!isTemplateValid && (
                    <div className="mt-2 p-3 rounded-lg bg-red-50 border border-red-200">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-red-700">Template não aprovado</p>
                          <p className="text-xs text-red-600 mt-1">
                            Este template não está aprovado no Meta Business Manager. 
                            Acesse <strong>Meta Business Manager {'>'} WhatsApp {'>'} Gerenciador de Modelos</strong> para criar e aprovar este template.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

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
                  <div className="mt-2 rounded-lg bg-primary/10 px-3 py-2 text-xs text-muted-foreground italic leading-relaxed whitespace-pre-line">
                    {getPreview(template)}
                  </div>

                  <button
                    onClick={() => handleSend(template)}
                    disabled={sending || !canSend || !isTemplateValid}
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
