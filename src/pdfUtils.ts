/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MatchHistoryEntry } from './types';
import { formatTime, formatDate, calculatePercentage } from './utils';

export function exportMatchToPDF(match: MatchHistoryEntry) {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(22);
  doc.setTextColor(255, 106, 0); // Primary orange
  doc.text('BASKETBALL COACH - GAMESTATS', 14, 20);
  
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`Tegenstander: ${match.opponent}`, 14, 30);
  doc.text(`Datum: ${formatDate(match.date)}`, 14, 37);
  doc.text(`Totaal Team Speeltijd: ${formatTime(match.totalMatchTime)}`, 14, 44);

  // Stats Table
  const tableData = match.players.map(p => {
    const fg = `${p.stats.fgm}/${p.stats.fga} (${calculatePercentage(p.stats.fgm, p.stats.fga)})`;
    const tp = `${p.stats.threeFgm}/${p.stats.threeFga} (${calculatePercentage(p.stats.threeFgm, p.stats.threeFga)})`;
    const ft = `${p.stats.ftm}/${p.stats.fta} (${calculatePercentage(p.stats.ftm, p.stats.fta)})`;
    
    return [
      `#${p.number} ${p.name}`,
      formatTime(p.totalTime),
      p.stats.points,
      fg,
      tp,
      ft,
      p.stats.assists,
      p.stats.rebounds,
      p.stats.steals,
      p.stats.blocks,
      p.stats.turnovers
    ];
  });

  autoTable(doc, {
    startY: 55,
    head: [['Speler', 'Tijd', 'PTN', 'FG', '3P', 'FT', 'AST', 'REB', 'STL', 'BLK', 'TO']],
    body: tableData,
    headStyles: { fillColor: [255, 106, 0] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { top: 55 },
  });

  doc.save(`match_${match.opponent}_${new Date(match.date).toISOString().split('T')[0]}.pdf`);
}
