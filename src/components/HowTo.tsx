import React from 'react';
import { HelpCircle, Filter, FileSpreadsheet, LayoutDashboard, Target, Users, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';

export function HowTo() {
  const { t } = useLanguage();
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
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('howtoTitle')}</h2>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('howtoIntro')}</p>
        </div>
      </motion.div>

      <div className="space-y-6">
        
        {/* Primeiros Passos */}
        <motion.div variants={item} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-100 p-2 rounded-lg">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-black text-slate-800">{t('howtoGenerateTitle')}</h3>
          </div>
          <div className="text-slate-600 space-y-3 leading-relaxed text-sm">
            <p>
              {t('howtoStartUpdate')}
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>{t('howtoExtract')}</strong> {t('howtoExtractDesc')}
              </li>
              <li>
                <strong>{t('howtoCalendar')}</strong> {t('howtoCalendarDesc')}
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
            <h3 className="text-lg font-black text-slate-800">{t('howtoTabsTitle')}</h3>
          </div>
          <div className="text-slate-600 space-y-4 leading-relaxed text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                   <LayoutDashboard className="w-4 h-4 text-emerald-600" /> {t('howtoTabDashboard')}
                </h4>
                <p>{t('howtoTabDashboardDesc')}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                   <Target className="w-4 h-4 text-emerald-600" /> {t('howtoTabLOB')}
                </h4>
                <p>{t('howtoTabLOBDesc')}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 md:col-span-2">
                <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                   <Users className="w-4 h-4 text-emerald-600" /> {t('howtoTabList')}
                </h4>
                <p>{t('howtoTabListDesc')}</p>
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
            <h3 className="text-lg font-black text-slate-800">{t('howtoFiltersTitle')}</h3>
          </div>
          <div className="text-slate-600 space-y-4 leading-relaxed text-sm">
             <p>{t('howtoFilterCore')}</p>
             
             <div className="space-y-3">
               <div>
                 <h4 className="font-bold text-slate-800 flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> {t('howtoFilterRealTime')}
                 </h4>
                 <p className="pl-4 border-l border-slate-200 ml-1">
                   {t('howtoFilterRealTimeDesc')}
                 </p>
               </div>

               <div>
                 <h4 className="font-bold text-slate-800 flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-amber-500"></span> {t('howtoFilterTime')}
                 </h4>
                 <p className="pl-4 border-l border-slate-200 ml-1">
                   {t('howtoFilterTimeDesc')}
                 </p>
               </div>

               <div>
                 <h4 className="font-bold text-slate-800 flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-blue-500"></span> {t('howtoFilterShifts')}
                 </h4>
                 <p className="pl-4 border-l border-slate-200 ml-1">
                   {t('howtoFilterShiftsDesc')}
                 </p>
               </div>

               <div>
                 <h4 className="font-bold text-slate-800 flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-rose-500"></span> {t('howtoOccurrencesGen')}
                 </h4>
                 <p className="pl-4 border-l border-slate-200 ml-1">
                   {t('howtoOccurrencesGenDesc')}
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
            <h3 className="text-lg font-black text-slate-800">{t('howtoOccurrencesTitle')}</h3>
          </div>
          <div className="text-slate-600 space-y-4 leading-relaxed text-sm">
             <p>{t('howtoAbbrevIntro')}</p>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                 <h4 className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded inline-block mb-1">A.T (Awaiting Tasks)</h4>
                 <p dangerouslySetInnerHTML={{ __html: t('howtoAbbrevAT') }}></p>
               </div>
               <div>
                 <h4 className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded inline-block mb-1">R&A (Review & Appeal)</h4>
                 <p dangerouslySetInnerHTML={{ __html: t('howtoAbbrevRA') }}></p>
               </div>
               <div>
                 <h4 className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded inline-block mb-1">Non-Mod (Geral)</h4>
                 <p>{t('howtoAbbrevNonMod')}</p>
               </div>
               <div>
                 <h4 className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded inline-block mb-1 text-[10px] uppercase tracking-wider">{t('check')}</h4>
                 <p>{t('howtoAbbrevCheck')}</p>
               </div>
             </div>
          </div>
        </motion.div>

        {/* Exportação PDF */}
        <motion.div variants={item} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="text-lg font-black text-slate-800">{t('howtoExportTitle')}</h3>
          </div>
          <div className="text-slate-600 space-y-4 leading-relaxed text-sm">
             <p>{t('howtoExportIntro')}</p>
             <p className="pl-4 border-l-2 border-indigo-200">
                {t('howtoExportFileRule')} <code className="text-indigo-600 font-bold bg-indigo-50 px-1 py-0.5 rounded">Report_Tipo_Data.pdf</code>.
             </p>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <h4 className="font-bold text-slate-800 mb-1">{t('howtoExportTardiness')}</h4>
                  <p>{t('howtoExportTardinessDesc1')}</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li><strong>Scheduled Shift:</strong> {t('howtoExportTardinessL1')}</li>
                    <li><strong>Effective Shift:</strong> {t('howtoExportTardinessL2')} <em>{t('howtoExportTardinessL2Eff')}</em> {t('howtoExportTardinessL2Cont')}</li>
                    <li><strong>Started at:</strong> {t('howtoExportTardinessL3')}</li>
                  </ul>
               </div>
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <h4 className="font-bold text-slate-800 mb-1">{t('howtoExportOther')}</h4>
                  <p>{t('howtoExportOtherDesc')}</p>
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
            <h3 className="text-lg font-black text-slate-800">{t('howtoSupportTitle')}</h3>
          </div>
          <div className="text-slate-600 space-y-3 leading-relaxed text-sm">
             <p>{t('howtoSupportDesc')}</p>
             <p><strong>{t('howtoWarning1')}</strong> {t('howtoWarning2')} <strong className="text-rose-600">{t('howtoWarning3')}</strong> {t('howtoWarning4')}</p>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg"><strong className="text-slate-800">{t('howtoStatusAttLabel')}:</strong> {t('howtoStatusAtt')}</div>
                <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-lg"><strong className="text-indigo-800">{t('howtoStatusLoaLabel')}:</strong> {t('howtoStatusLoa')}</div>
                <div className="bg-cyan-50 border border-cyan-200 p-3 rounded-lg"><strong className="text-cyan-800">{t('howtoStatusPtoLabel')}:</strong> {t('howtoStatusPto')}</div>
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg"><strong className="text-rose-800">{t('howtoStatusSlLabel')}:</strong> {t('howtoStatusSl')}</div>
                <div className="bg-red-50 border border-red-200 p-3 rounded-lg"><strong className="text-red-800">{t('howtoStatusSusppLabel')}:</strong> {t('howtoStatusSuspp')}</div>
                <div className="bg-slate-100 border border-slate-300 p-3 rounded-lg"><strong className="text-slate-800">{t('howtoStatusOffLabel')}:</strong> {t('howtoStatusOff')}</div>
             </div>

             <div className="bg-rose-50 border border-rose-100 rounded-lg p-4 mt-6">
                <h4 className="font-black text-rose-800 flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span> {t('howtoSupportStaffBtn')}
                </h4>
                <p className="text-rose-700/80">{t('howtoSupportStaffDesc')}</p>
             </div>
          </div>
        </motion.div>

        {/* Updates / Excedentes */}
        <motion.div variants={item} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-fuchsia-100 p-2 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-fuchsia-600" />
            </div>
            <h3 className="text-lg font-black text-slate-800">{t('howtoUpdatesTitle')}</h3>
          </div>
          <div className="text-slate-600 space-y-4 leading-relaxed text-sm">
             <p>{t('howtoUpdatesIntro')}</p>
             
             <div className="bg-fuchsia-50 p-4 rounded-xl border border-fuchsia-100">
               <h4 className="font-bold text-fuchsia-800 mb-2 flex items-center gap-2">
                 Somente Excedentes
               </h4>
               <p className="text-fuchsia-900/80 mb-2">{t('howtoUpdatesExceedesc')}</p>
               <ul className="list-disc pl-5 space-y-1 text-fuchsia-800">
                 <li><strong>Meal:</strong> {t('howtoMealLimit')}</li>
                 <li><strong>Short:</strong> {t('howtoShortLimit')}</li>
                 <li><strong>Wellness / Praying:</strong> {t('howtoWellLimit')}</li>
                 <li><strong>Organic:</strong> {t('howtoOrgLimit')}</li>
               </ul>
             </div>
          </div>
        </motion.div>

      </div>
    </motion.div>
  );
}
