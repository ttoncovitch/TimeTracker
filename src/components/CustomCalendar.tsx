import React, { useState, useMemo } from 'react';
import { EmployeeSummary } from '../types';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CustomCalendarProps {
  summaries: EmployeeSummary[];
  selectedDates: Date[] | undefined;
  onSelectDates: (dates: Date[] | undefined) => void;
}

export function CustomCalendar({ summaries, selectedDates, onSelectDates }: CustomCalendarProps) {
  const [view, setView] = useState<'year' | 'month' | 'day'>('year');
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    summaries.forEach(s => {
      s.dailyRecords.forEach(r => dates.add(r.date));
    });
    return Array.from(dates).sort();
  }, [summaries]);

  const structure = useMemo(() => {
    const struct: Record<string, Record<string, string[]>> = {};
    availableDates.forEach(dateStr => {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return;
      const year = parts[0];
      const month = `${parts[0]}-${parts[1]}`;
      const day = dateStr;
      
      if (!struct[year]) struct[year] = {};
      if (!struct[year][month]) struct[year][month] = [];
      struct[year][month].push(day);
    });
    return struct;
  }, [availableDates]);

  const years = Object.keys(structure).sort();

  if (view === 'year') {
    return (
      <div className="p-4 w-64">
        <h4 className="text-sm font-bold text-slate-700 mb-3 text-center uppercase tracking-wider">Selecione o Ano</h4>
        <div className="grid grid-cols-2 gap-2">
          {years.map(year => (
            <Button
              key={year}
              variant="outline"
              onClick={() => {
                setSelectedYear(year);
                setView('month');
              }}
              className="w-full font-black text-slate-700"
            >
              {year}
            </Button>
          ))}
          {years.length === 0 && <p className="text-xs text-slate-500 col-span-2 text-center">Nenhum dado disponível.</p>}
        </div>
      </div>
    );
  }

  if (view === 'month' && selectedYear) {
    const months = Object.keys(structure[selectedYear]).sort();
    return (
      <div className="p-4 w-64">
        <div className="flex items-center mb-3">
          <button onClick={() => setView('year')} className="p-1 hover:bg-slate-100 rounded text-slate-500">
            <ChevronLeft size={16} />
          </button>
          <h4 className="text-sm font-bold text-slate-700 flex-1 text-center uppercase tracking-wider">{selectedYear}</h4>
          <div className="w-6" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {months.map(monthStr => {
            const date = parseISO(`${monthStr}-01`);
            const monthName = format(date, 'MMM', { locale: ptBR });
            return (
              <Button
                key={monthStr}
                variant="outline"
                className="w-full font-bold uppercase text-xs"
                onClick={() => {
                  setSelectedMonth(monthStr);
                  setView('day');
                }}
              >
                {monthName}
              </Button>
            );
          })}
        </div>
      </div>
    );
  }

  if (view === 'day' && selectedYear && selectedMonth) {
    const days = structure[selectedYear]?.[selectedMonth] || [];
    
    const handleSelectAll = () => {
      const newDates = days.map(d => new Date(d + 'T12:00:00'));
      onSelectDates(newDates);
    };

    const isSelected = (dayStr: string) => {
      if (!selectedDates) return false;
      return selectedDates.some(d => format(d, 'yyyy-MM-dd') === dayStr);
    };

    const handleSelectDay = (dayStr: string) => {
      const current = selectedDates ? [...selectedDates] : [];
      const matchIdx = current.findIndex(d => format(d, 'yyyy-MM-dd') === dayStr);
      if (matchIdx >= 0) {
        current.splice(matchIdx, 1);
      } else {
        current.push(new Date(dayStr + 'T12:00:00'));
      }
      onSelectDates(current.length > 0 ? current : undefined);
    };

    return (
      <div className="p-4 w-[280px]">
        <div className="flex items-center mb-3">
          <button onClick={() => setView('month')} className="p-1 hover:bg-slate-100 rounded text-slate-500">
            <ChevronLeft size={16} />
          </button>
          <h4 className="text-sm font-bold text-slate-700 flex-1 text-center uppercase tracking-wider">
            {format(parseISO(`${selectedMonth}-01`), 'MMM yyyy', { locale: ptBR })}
          </h4>
          <div className="w-6" />
        </div>
        
        <Button 
          variant="secondary" 
          size="sm" 
          className="w-full mb-3 text-xs font-bold"
          onClick={handleSelectAll}
        >
          SELECIONAR MÊS TODO
        </Button>

        <div className="grid grid-cols-4 gap-1">
          {days.map(dayStr => {
            const dayNum = parseInt(dayStr.split('-')[2], 10);
            const selected = isSelected(dayStr);
            return (
              <Button
                key={dayStr}
                variant={selected ? "default" : "outline"}
                size="sm"
                className={`h-8 font-black ${selected ? 'bg-blue-600 text-white' : 'text-slate-600'}`}
                onClick={() => handleSelectDay(dayStr)}
              >
                {dayNum}
              </Button>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
