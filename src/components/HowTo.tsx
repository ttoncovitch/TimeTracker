import React from 'react';
import { HelpCircle, Filter, FileSpreadsheet, LayoutDashboard, Target, Users, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

export function HowTo() {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="max-w-4xl mx-auto py-8 px-4"
    >
      <motion.div variants={item} className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center shadow-inner">
          <HelpCircle className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Como Utilizar</h2>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Tutorial e Guia de Uso da Ferramenta</p>
        </div>
      </motion.div>

      <div className="space-y-6">
        
        {/* Primeiros Passos */}
        <motion.div variants={item} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-100 p-2 rounded-lg">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-black text-slate-800">1. Primeiros Passos (Importação)</h3>
          </div>
          <div className="text-slate-600 space-y-3 leading-relaxed text-sm">
            <p>
              Para iniciar, você deve atualizar as bases de dados nos botões correspondentes no topo da tela:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Atualizar Extract:</strong> O extrato deve ser gerado na aba <em>Calibration</em> do <strong>Byteworks</strong>. Selecione todos os departamentos exceto "Management", defina a data pretendida iniciando sempre pelo horário de 00:00, clique em "export statistics" e faça o download assim que estiver pronto em "My Export". A ferramenta formatará os horários e identificará rotinas, status, overbreaks, atrasos (tardiness) e early leaves.
              </li>
              <li>
                <strong>Atualizar Calendário:</strong> (Opcional, porém recomendado). Trata-se do arquivo <strong>Bytedance Schedules</strong>. Faça o download do arquivo, e depois o upload no local indicado para processar o calendário até sua última atualização. A ferramenta irá cruzar as informações, mapeando LOB, Língua, Turno Específico (Shift) e Faltas que não constam no extrato (e.g. quando alguém não logou).
              </li>
            </ul>
          </div>
        </motion.div>

        {/* Visão de Abas */}
        <motion.div variants={item} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-emerald-100 p-2 rounded-lg">
              <LayoutDashboard className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="text-lg font-black text-slate-800">2. Modos de Visualização</h3>
          </div>
          <div className="text-slate-600 space-y-4 leading-relaxed text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                   <LayoutDashboard className="w-4 h-4 text-emerald-600" /> Overview / Dashboard
                </h4>
                <p>Mostra uma visão panorâmica e estatística do dia, semana ou mês. Aqui você terá contato direto com os "Top Infratores" no geral ou em infrações específicas (Organic, IDLE, Non-Mod).</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                   <Target className="w-4 h-4 text-emerald-600" /> LOB's Performance
                </h4>
                <p>Divide todos os agentes por operação (LOB) e permite avaliar cada operação através das línguas. Essencial para verificar quais operações e quais idiomas de uma mesma operação precisam de maior suporte.</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 md:col-span-2">
                <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                   <Users className="w-4 h-4 text-emerald-600" /> Agentes
                </h4>
                <p>Uma lista detalhada caso a caso com todas as pessoas que caem dentro dos filtros estabelecidos, permitindo abrir seus logs diários, investigar os breaks exatos ou ver qual justificação (status) está vinculada aquele agente em determinado dia.</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Filtros e Status Extras */}
        <motion.div variants={item} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-amber-100 p-2 rounded-lg">
              <Filter className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="text-lg font-black text-slate-800">3. Como Funcionam os Filtros Combinados</h3>
          </div>
          <div className="text-slate-600 space-y-4 leading-relaxed text-sm">
             <p>A barra de filtros é o núcleo da ferramenta. Todos os filtros funcionam em conjunto (acumulativos), filtrando uns sobre os outros:</p>
             
             <div className="space-y-3">
               <div>
                 <h4 className="font-bold text-slate-800 flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-amber-500"></span> Tempo / Calendário
                 </h4>
                 <p className="pl-4 border-l border-slate-200 ml-1">
                   Filtra os dados por "Hoje", "Semana", "Mês" ou "Dia Específico". Tudo o que você vê na tela estará restrito especificamente a este período.
                   <br/><em className="text-slate-500 text-xs">Exemplo: Se você selecionar "Janeiro" e depois clicar em "Férias (PTO/VAC)", a ferramenta mostrará <strong>quem esteve de férias especificamente durante o mês de Janeiro</strong>. Agentes que só estiveram de férias em Fevereiro não aparecerão.</em>
                 </p>
               </div>

               <div>
                 <h4 className="font-bold text-slate-800 flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-blue-500"></span> Turnos (Shifts)
                 </h4>
                 <p className="pl-4 border-l border-slate-200 ml-1">
                   Filtra agentes baseados em seus horários de escala. Excelente para isolar a visualização a um turno específico.
                   <br/><em className="text-slate-500 text-xs">Exemplo: Selecionando "Mês", o turno "14:00-23:00" e o filtro de infração "IDLE", você verá <strong>apenas o pessoal do turno da noite que teve infrações de IDLE durante este mês</strong>.</em>
                 </p>
               </div>

               <div>
                 <h4 className="font-bold text-slate-800 flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-rose-500"></span> Infrações Gerais
                 </h4>
                 <p className="pl-4 border-l border-slate-200 ml-1">
                   Filtros de ocorrências: OVERBREAKS, ORGANIC, IDLE, NON-MOD, TARDINESS (Atrasos), MINOR TARDINESS (Atrasos Curtos), EARLY LEAVE. 
                   Ao clicar nestes botões, a lista mostrará apenas quem cometeu estas exatas violações no período selecionado.
                 </p>
               </div>
             </div>
          </div>
        </motion.div>

        {/* Status Específicos e Significados */}
        <motion.div variants={item} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-teal-100 p-2 rounded-lg">
              <Users className="w-5 h-5 text-teal-600" />
            </div>
            <h3 className="text-lg font-black text-slate-800">4. Status dos Agentes e Abreviações</h3>
          </div>
          <div className="text-slate-600 space-y-4 leading-relaxed text-sm">
             <p>A visualização de agentes detalha como o tempo foi gasto. Para facilitar a leitura, o sistema usa as seguintes nomenclaturas:</p>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                 <h4 className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded inline-block mb-1">A.T (Awaiting Tasks)</h4>
                 <p>Parte do status <em>Non-Moderating</em>, indica especificamente o tempo em que o agente estava aguardando tarefas no sistema, sem atuar ativamente.</p>
               </div>
               <div>
                 <h4 className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded inline-block mb-1">R&A (Review & Appeal)</h4>
                 <p>Parte do status <em>Non-Moderating</em>, indica o tempo gasto revisando ou recorrendo de decisões de moderação.</p>
               </div>
               <div>
                 <h4 className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded inline-block mb-1">Non-Mod (Geral)</h4>
                 <p>Qualquer outra atividade que não envolva moderação direta, mas for classificada como logada no sistema.</p>
               </div>
               <div>
                 <h4 className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded inline-block mb-1">CHECK</h4>
                 <p>Aparece quando o horário de turno (shift) detectado no relatório não bate com a escala enviada via calendário. Requer verificação se o agente realizou uma troca de horário ou hora extra.</p>
               </div>
             </div>
          </div>
        </motion.div>

        {/* Support Staff e Status */}
        <motion.div variants={item} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-rose-100 p-2 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <h3 className="text-lg font-black text-slate-800">5. Status Extras & Botão Support Staff</h3>
          </div>
          <div className="text-slate-600 space-y-3 leading-relaxed text-sm">
             <p>Ao lado da barra de ocorrências comuns e turnos, temos o seletor rápido de Status Específicos (ATT, LOA, PTO, SL, SUSPP, OFF, FALTAS, OFFBOARDED). </p>
             <p><strong>Atenção:</strong> Ao clicar em qualquer um deles, você irá "limpar" a barra orgânica de ocorrências normais. A ideia do painel de Status Extras é observar <strong className="text-rose-600">exatamente</strong> qual agente encaixa naquela condição excepcional no período temporal selecionado.</p>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg"><strong className="text-slate-800">ATT (Attrition):</strong> Agentes que saíram do projeto/empresa.</div>
                <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-lg"><strong className="text-indigo-800">LOA (Licença):</strong> Leave of Absence (Licença maternidade/paternidade, luto).</div>
                <div className="bg-cyan-50 border border-cyan-200 p-3 rounded-lg"><strong className="text-cyan-800">PTO/VAC (Férias):</strong> Paid Time Off, agentes de férias.</div>
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg"><strong className="text-rose-800">SL (Atestado):</strong> Sick Leave, licença médica suportada por atestado.</div>
                <div className="bg-red-50 border border-red-200 p-3 rounded-lg"><strong className="text-red-800">SUSPP:</strong> Agentes suspensos.</div>
                <div className="bg-slate-100 border border-slate-300 p-3 rounded-lg"><strong className="text-slate-800">OFF/FOLGA:</strong> Dias regulamentares de folga.</div>
             </div>

             <div className="bg-rose-50 border border-rose-100 rounded-lg p-4 mt-6">
                <h4 className="font-black text-rose-800 flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span> O Botão Mágico: "Support Staff"
                </h4>
                <p className="text-rose-700/80">Ao clicar em um filtro de Status Extra (ex: PTO), a ferramenta buscará todos na base em PTO. Porém, as posições de liderança e suporte de "Operação" ficarão invisíveis. Para ver quem da liderança <em>(Quality, Trainer, TLs, RTAs)</em> está de férias, o botão "SUPPORT STAFF" acenderá no filtro de Status Extra (em cor vibrante). Clicando nele, a visão mostrará <strong>Apenas</strong> e <strong>Somente</strong> a liderança que estiver listada naquele Status Extra ou Falta.</p>
             </div>
          </div>
        </motion.div>

      </div>
    </motion.div>
  );
}
