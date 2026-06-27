/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MatchHistoryEntry } from './types';
import { formatTime, formatDate, calculatePercentage } from './utils';

export function exportMatchToPDF(match: MatchHistoryEntry, theme: 'dark' | 'light' = 'dark') {
  const doc = new jsPDF();
  const isLight = theme === 'light';
  
  const paintPage = () => {
    const pageSize = doc.internal.pageSize;
    const w = pageSize.width ? pageSize.width : pageSize.getWidth();
    const h = pageSize.height ? pageSize.height : pageSize.getHeight();
    // Background color based on theme
    if (isLight) {
      doc.setFillColor(226, 232, 240); // #E2E8F0
    } else {
      doc.setFillColor(15, 23, 42); // #0F172A
    }
    doc.rect(0, 0, w, h, 'F');
    // Accent orange strip on left edge
    doc.setFillColor(255, 106, 0);
    doc.rect(0, 0, 4, h, 'F');
  };

  // Paint the first page
  paintPage();
  
  // Header Logo/Brand
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(11);
  if (isLight) {
    doc.setTextColor(255, 106, 0); // Primary orange
  } else {
    doc.setTextColor(255, 255, 255); // White
  }
  doc.text('BASKETBALL COACH', 14, 15);
  
  // Stylized Match Title & Score
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(22); // Larger font size
  doc.setTextColor(255, 106, 0); // Primary orange for title text
  const scoreText = `${match.teamScore ?? 0} - ${match.opponentScore ?? 0}`;
  doc.text(`VS ${match.opponent.toUpperCase()}  (${scoreText})`, 14, 23);
  
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(8.5);
  if (isLight) {
    doc.setTextColor(15, 23, 42);
  } else {
    doc.setTextColor(255, 255, 255); // White
  }
  doc.text('OFFICIËLE WEDSTRIJD STATISTIEKEN', 14, 28);

  // Separator line
  doc.setDrawColor(255, 106, 0);
  doc.setLineWidth(0.5);
  doc.line(14, 31, 196, 31);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  if (isLight) {
    doc.setTextColor(71, 85, 105);
    doc.text(`Datum: ${formatDate(match.date)}`, 14, 38);
    doc.text(`Wedstrijdduur: ${formatTime(match.totalMatchTime)}`, 14, 44);
  } else {
    doc.setTextColor(255, 255, 255);
    doc.text(`Datum: ${formatDate(match.date)}`, 14, 38);
    doc.text(`Wedstrijdduur: ${formatTime(match.totalMatchTime)}`, 14, 44);
  }

  // Stats Table
  const tableData = match.players.map(p => {
    const fg = `${p.stats.fgm}/${p.stats.fga} (${calculatePercentage(p.stats.fgm, p.stats.fga)})`;
    const tp = `${p.stats.threeFgm}/${p.stats.threeFga} (${calculatePercentage(p.stats.threeFgm, p.stats.threeFga)})`;
    const ft = `${p.stats.ftm}/${p.stats.fta} (${calculatePercentage(p.stats.ftm, p.stats.fta)})`;
    const pm = p.stats.plusMinus !== undefined ? (p.stats.plusMinus > 0 ? `+${p.stats.plusMinus}` : `${p.stats.plusMinus}`) : '0';
    
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
      p.stats.turnovers,
      p.stats.pf || 0,
      pm
    ];
  });

  // Calculate team total for this match
  let tTime = 0, tPtn = 0, tAst = 0, tReb = 0, tStl = 0, tBlk = 0, tTo = 0, tPf = 0, tPm = 0;
  let tFgm = 0, tFga = 0, t3Fgm = 0, t3Fga = 0, tFtm = 0, tFta = 0;

  match.players.forEach(p => {
    tTime += p.totalTime || 0;
    tPtn += p.stats.points || 0;
    tAst += p.stats.assists || 0;
    tReb += p.stats.rebounds || 0;
    tStl += p.stats.steals || 0;
    tBlk += p.stats.blocks || 0;
    tTo += p.stats.turnovers || 0;
    tPf += p.stats.pf || 0;
    tPm += p.stats.plusMinus || 0;
    tFgm += p.stats.fgm || 0;
    tFga += p.stats.fga || 0;
    t3Fgm += p.stats.threeFgm || 0;
    t3Fga += p.stats.threeFga || 0;
    tFtm += p.stats.ftm || 0;
    tFta += p.stats.fta || 0;
  });

  const fgTotal = `${tFgm}/${tFga} (${calculatePercentage(tFgm, tFga)})`;
  const tpTotal = `${t3Fgm}/${t3Fga} (${calculatePercentage(t3Fgm, t3Fga)})`;
  const ftTotal = `${tFtm}/${tFta} (${calculatePercentage(tFtm, tFta)})`;
  const matchDiff = (match.teamScore ?? 0) - (match.opponentScore ?? 0);
  const pmTotal = matchDiff > 0 ? `+${matchDiff}` : `${matchDiff}`;

  tableData.push([
    'TEAM TOTAAL',
    formatTime(tTime),
    tPtn,
    fgTotal,
    tpTotal,
    ftTotal,
    tAst,
    tReb,
    tStl,
    tBlk,
    tTo,
    tPf,
    pmTotal
  ]);

  autoTable(doc, {
    startY: 50,
    head: [['Speler', 'Tijd', 'PTN', 'FG', '3P', 'FT', 'AST', 'REB', 'STL', 'BLK', 'TO', 'PF', '+/-']],
    body: tableData,
    theme: 'plain',
    styles: {
      fillColor: isLight ? [255, 255, 255] : [30, 41, 59], // #FFFFFF or #1E293B
      textColor: isLight ? [15, 23, 42] : [255, 255, 255],
      fontSize: 8,
      font: 'helvetica',
      cellPadding: 3,
      lineColor: isLight ? [226, 232, 240] : [15, 23, 42],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [255, 106, 0], // Neon orange
      textColor: [255, 255, 255],
      fontStyle: 'bolditalic',
    },
    alternateRowStyles: {
      fillColor: isLight ? [241, 245, 249] : [21, 32, 51], // #F1F5F9 or #152033
    },
    margin: { left: 14, right: 14 },
    willDrawPage: function(data: any) {
      if (data.pageNumber !== 1) {
        paintPage();
      }
    },
    didParseCell: function (data) {
      if (data.row.raw[0] === 'TEAM TOTAAL') {
        data.cell.styles.fillColor = [255, 106, 0];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bolditalic';
      }
    }
  });

  doc.save(`match_${match.opponent}_${new Date(match.date).toISOString().split('T')[0]}.pdf`);
}

export function exportSeasonStatsToPDF(stats: any[], theme: 'dark' | 'light' = 'dark', customTotalPlusMinus?: number) {
  const doc = new jsPDF();
  const isLight = theme === 'light';
  
  const paintPage = () => {
    const pageSize = doc.internal.pageSize;
    const w = pageSize.width ? pageSize.width : pageSize.getWidth();
    const h = pageSize.height ? pageSize.height : pageSize.getHeight();
    // Background color based on theme
    if (isLight) {
      doc.setFillColor(226, 232, 240); // #E2E8F0
    } else {
      doc.setFillColor(15, 23, 42); // #0F172A
    }
    doc.rect(0, 0, w, h, 'F');
    // Accent orange strip on left edge
    doc.setFillColor(255, 106, 0);
    doc.rect(0, 0, 4, h, 'F');
  };

  // Paint the first page
  paintPage();
  
  // Header Logo/Brand
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(11);
  if (isLight) {
    doc.setTextColor(255, 106, 0); // Primary orange
  } else {
    doc.setTextColor(255, 255, 255); // White
  }
  doc.text('BASKETBALL COACH', 14, 15);
  
  // Stylized Season Title
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(22); // Larger font size
  doc.setTextColor(255, 106, 0); // Primary orange for title text
  doc.text('SEIZOENSSTATISTIEKEN', 14, 23);
  
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(8.5);
  if (isLight) {
    doc.setTextColor(15, 23, 42);
  } else {
    doc.setTextColor(255, 255, 255); // White
  }
  doc.text('OFFICIËLE SEIZOENSRAPPORTAGE', 14, 28);

  // Separator line
  doc.setDrawColor(255, 106, 0);
  doc.setLineWidth(0.5);
  doc.line(14, 31, 196, 31);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  if (isLight) {
    doc.setTextColor(71, 85, 105);
    doc.text(`Gegenereerd op: ${new Date().toLocaleDateString('nl-NL')}`, 14, 38);
  } else {
    doc.setTextColor(255, 255, 255);
    doc.text(`Gegenereerd op: ${new Date().toLocaleDateString('nl-NL')}`, 14, 38);
  }

  const totalTeamMatches = stats.length > 0 ? Math.max(...stats.map(s => s.matches || 0)) : 0;

  const tableData = stats.map(s => {
    const pmVal = s.plusMinus || 0;
    const pmStr = pmVal > 0 ? `+${pmVal}` : `${pmVal}`;
    return [
      `#${s.number} ${s.name}`,
      s.matches,
      formatTime(s.totalTime),
      `${Math.round(s.points / s.matches)} avg`,
      calculatePercentage(s.fgm, s.fga),
      calculatePercentage(s.threeFgm, s.threeFga),
      calculatePercentage(s.ftm, s.fta),
      (s.rebounds / s.matches).toFixed(1),
      (s.assists / s.matches).toFixed(1),
      (s.steals / s.matches).toFixed(1),
      (s.blocks / s.matches).toFixed(1),
      (s.turnovers / s.matches).toFixed(1),
      (s.pf / s.matches).toFixed(1),
      pmStr
    ];
  });

  // Calculate season totals
  let totalTime = 0;
  let totalPtn = 0;
  let totalFgm = 0, totalFga = 0;
  let total3Fgm = 0, total3Fga = 0;
  let totalFtm = 0, totalFta = 0;
  let totalReb = 0, totalAst = 0;
  let totalStl = 0, totalBlk = 0, totalTo = 0, totalPf = 0, totalPm = 0;

  stats.forEach(s => {
    totalTime += s.totalTime || 0;
    totalPtn += s.points || 0;
    totalFgm += s.fgm || 0;
    totalFga += s.fga || 0;
    total3Fgm += s.threeFgm || 0;
    total3Fga += s.threeFga || 0;
    totalFtm += s.ftm || 0;
    totalFta += s.fta || 0;
    totalReb += s.rebounds || 0;
    totalAst += s.assists || 0;
    totalStl += s.steals || 0;
    totalBlk += s.blocks || 0;
    totalTo += s.turnovers || 0;
    totalPf += s.pf || 0;
    totalPm += s.plusMinus || 0;
  });

  const finalTotalPm = customTotalPlusMinus !== undefined ? customTotalPlusMinus : totalPm;
  const totalPmStr = finalTotalPm > 0 ? `+${finalTotalPm}` : `${finalTotalPm}`;

  tableData.push([
    'TEAM TOTAAL',
    totalTeamMatches,
    formatTime(totalTime),
    `${totalPtn} (avg ${totalTeamMatches > 0 ? Math.round(totalPtn / totalTeamMatches) : 0})`,
    calculatePercentage(totalFgm, totalFga),
    calculatePercentage(total3Fgm, total3Fga),
    calculatePercentage(totalFtm, totalFta),
    totalTeamMatches > 0 ? (totalReb / totalTeamMatches).toFixed(1) : '0.0',
    totalTeamMatches > 0 ? (totalAst / totalTeamMatches).toFixed(1) : '0.0',
    totalTeamMatches > 0 ? (totalStl / totalTeamMatches).toFixed(1) : '0.0',
    totalTeamMatches > 0 ? (totalBlk / totalTeamMatches).toFixed(1) : '0.0',
    totalTeamMatches > 0 ? (totalTo / totalTeamMatches).toFixed(1) : '0.0',
    totalTeamMatches > 0 ? (totalPf / totalTeamMatches).toFixed(1) : '0.0',
    totalPmStr
  ]);

  autoTable(doc, {
    startY: 48,
    head: [['Speler', 'W', 'Tot. Tijd', 'PTN AVG', 'FG%', '3P%', 'FT%', 'REB AVG', 'AST AVG', 'STL AVG', 'BLK AVG', 'TO AVG', 'PF AVG', '+/-']],
    body: tableData,
    theme: 'plain',
    styles: {
      fillColor: isLight ? [255, 255, 255] : [30, 41, 59], // #FFFFFF or #1E293B
      textColor: isLight ? [15, 23, 42] : [255, 255, 255],
      fontSize: 7.5,
      font: 'helvetica',
      cellPadding: 2.5,
      lineColor: isLight ? [226, 232, 240] : [15, 23, 42],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [255, 106, 0], // Neon orange
      textColor: [255, 255, 255],
      fontStyle: 'bolditalic',
    },
    alternateRowStyles: {
      fillColor: isLight ? [241, 245, 249] : [21, 32, 51], // #F1F5F9 or #152033
    },
    margin: { left: 14, right: 14 },
    willDrawPage: function(data: any) {
      if (data.pageNumber !== 1) {
        paintPage();
      }
    },
    didParseCell: function (data) {
      if (data.row.raw[0] === 'TEAM TOTAAL') {
        data.cell.styles.fillColor = [255, 106, 0];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bolditalic';
      }
    }
  });

  doc.save(`seizoensstatistieken_${new Date().toISOString().split('T')[0]}.pdf`);
}
