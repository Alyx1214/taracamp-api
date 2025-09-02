import { useEffect, useRef, useState, useCallback } from 'react';
import { getMonthlyReservations } from '../../apis/dashboardApi';
import styles from './MonthlyChart.module.css';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MonthlyChart = () => {
  const canvasRef = useRef(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [chartData, setChartData] = useState({
    labels: months,
    datasets: [
      { label: 'Confirmed', data: [] },
      { label: 'Cancelled', data: [] },
    ],
  });
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);

  useEffect(() => {
    const currentYear = new Date().getFullYear();
    setAvailableYears(Array.from({ length: 3 }, (_, i) => currentYear - i));
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getMonthlyReservations(selectedYear);
        const payload = res?.data; // server: { confirmed: number[12], cancelled: number[12] }
        if (payload && Array.isArray(payload.confirmed) && Array.isArray(payload.cancelled)) {
          setChartData({
            labels: months,
            datasets: [
              { label: 'Confirmed', data: payload.confirmed },
              { label: 'Cancelled', data: payload.cancelled },
            ],
          });
        } else {
          console.error('Unexpected response structure for monthly reservations:', res);
          setChartData({
            labels: months,
            datasets: [
              { label: 'Confirmed', data: [] },
              { label: 'Cancelled', data: [] },
            ],
          });
        }
      } catch (error) {
        console.error('Error fetching monthly reservations:', error);
        setChartData({
          labels: months,
          datasets: [
            { label: 'Confirmed', data: [] },
            { label: 'Cancelled', data: [] },
          ],
        });
      }
    };

    fetchData();
  }, [selectedYear]);

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const cssWidth = canvas.offsetWidth;
    const cssHeight = canvas.offsetHeight;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = cssWidth;
    const height = cssHeight;
    ctx.clearRect(0, 0, width, height);

    const confirmedData = chartData.datasets?.[0]?.data || [];
    const cancelledData = chartData.datasets?.[1]?.data || [];
    if (confirmedData.length === 0 && cancelledData.length === 0) return;

    const maxValue = Math.max(...confirmedData, ...cancelledData, 0) + 10;
    const chartHeight = height - 80;
    const chartWidth = width - 100;
    const startX = 50;
    const startY = height - 50;
    const stepX = chartWidth / (months.length - 1);

    // grid lines + y labels
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = startY - (i * chartHeight) / 5;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX + chartWidth, y);
      ctx.stroke();

      ctx.fillStyle = '#9ca3af';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'right';
      const labelValue = Math.round((i * maxValue) / 5);
      ctx.fillText(labelValue.toString(), startX - 10, y + 3);
    }

    const animatedConfirmedData = confirmedData.map((v) => v * animationProgress);
    const animatedCancelledData = cancelledData.map((v) => v * animationProgress);

    // confirmed series
    if (animationProgress > 0) {
      ctx.strokeStyle = '#22c55e';
      ctx.fillStyle = 'rgba(34, 197, 94, 0.1)';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      animatedConfirmedData.forEach((value, index) => {
        const x = startX + index * stepX;
        const y = startY - (value / maxValue) * chartHeight;
        ctx.lineTo(x, y);
      });
      ctx.lineTo(startX + chartWidth, startY);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      animatedConfirmedData.forEach((value, index) => {
        const x = startX + index * stepX;
        const y = startY - (value / maxValue) * chartHeight;
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();

      animatedConfirmedData.forEach((value, index) => {
        const x = startX + index * stepX;
        const y = startY - (value / maxValue) * chartHeight;
        ctx.beginPath();
        ctx.arc(x, y, hoveredPoint?.type === 'confirmed' && hoveredPoint?.index === index ? 6 : 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#22c55e';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    // cancelled series
    if (animationProgress > 0) {
      ctx.strokeStyle = '#ef4444';
      ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      animatedCancelledData.forEach((value, index) => {
        const x = startX + index * stepX;
        const y = startY - (value / maxValue) * chartHeight;
        ctx.lineTo(x, y);
      });
      ctx.lineTo(startX + chartWidth, startY);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      animatedCancelledData.forEach((value, index) => {
        const x = startX + index * stepX;
        const y = startY - (value / maxValue) * chartHeight;
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();

      animatedCancelledData.forEach((value, index) => {
        const x = startX + index * stepX;
        const y = startY - (value / maxValue) * chartHeight;
        ctx.beginPath();
        ctx.arc(x, y, hoveredPoint?.type === 'cancelled' && hoveredPoint?.index === index ? 6 : 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    // x labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    months.forEach((m, i) => {
      const x = startX + i * stepX;
      ctx.fillText(m, x, startY + 20);
    });

    // tooltip
    if (hoveredPoint && animationProgress > 0) {
      const { index, x, y } = hoveredPoint;
      const confirmedValue = confirmedData[index] ?? 0;
      const cancelledValue = cancelledData[index] ?? 0;

      const tooltipText = `${months[index]}: Confirmed: ${confirmedValue}, Cancelled: ${cancelledValue}`;
      ctx.font = '12px Inter, sans-serif';
      const textMetrics = ctx.measureText(tooltipText);
      const tooltipWidth = textMetrics.width + 16;
      const tooltipHeight = 40;

      let tooltipX = x - tooltipWidth / 2;
      let tooltipY = y - tooltipHeight - 10;

      const widthClamp = width - 10;
      if (tooltipX < 10) tooltipX = 10;
      if (tooltipX + tooltipWidth > widthClamp) tooltipX = widthClamp - tooltipWidth;
      if (tooltipY < 10) tooltipY = y + 20;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(`${months[index]}`, tooltipX + 8, tooltipY + 16);
      ctx.fillText(`Confirmed: ${confirmedValue}`, tooltipX + 8, tooltipY + 32);
      ctx.fillText(`Cancelled: ${cancelledValue}`, tooltipX + 100, tooltipY + 32);
    }
  }, [hoveredPoint, animationProgress, chartData]);

  useEffect(() => {
    let animationFrame;
    let startTime;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const duration = 1500;
      const progress = Math.min(elapsed / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setAnimationProgress(easeOutQuart);
      if (progress < 1) animationFrame = requestAnimationFrame(animate);
    };

    setAnimationProgress(0);
    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [chartData]);

  useEffect(() => {
    drawChart();
  }, [drawChart]);

  const handleMouseMove = useCallback((event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    const chartHeight = height - 80;
    const chartWidth = width - 100;
    const startX = 50;
    const startY = height - 50;
    const stepX = chartWidth / (months.length - 1);

    const confirmedData = chartData.datasets?.[0]?.data || [];
    const cancelledData = chartData.datasets?.[1]?.data || [];
    if (confirmedData.length === 0 && cancelledData.length === 0) return;

    const maxValue = Math.max(...confirmedData, ...cancelledData, 0) + 10;

    let closestPoint = null;
    let minDistance = Infinity;

    confirmedData.forEach((value, index) => {
      const x = startX + index * stepX;
      const y = startY - (value / maxValue) * chartHeight;
      const distance = Math.hypot(mouseX - x, mouseY - y);
      if (distance < 15 && distance < minDistance) {
        minDistance = distance;
        closestPoint = { type: 'confirmed', index, x, y };
      }
    });

    cancelledData.forEach((value, index) => {
      const x = startX + index * stepX;
      const y = startY - (value / maxValue) * chartHeight;
      const distance = Math.hypot(mouseX - x, mouseY - y);
      if (distance < 15 && distance < minDistance) {
        minDistance = distance;
        closestPoint = { type: 'cancelled', index, x, y };
      }
    });

    setHoveredPoint(closestPoint);
  }, [chartData]);

  const handleMouseLeave = useCallback(() => {
    setHoveredPoint(null);
  }, []);

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <div className={styles.chartTitle}>Monthly Reservations</div>
        <div className={styles.yearSelector}>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className={styles.yearSelect}
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <div className={`${styles.legendDot} ${styles.completed}`}></div>
            <span>Confirmed</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendDot} ${styles.cancelled}`}></div>
            <span>Cancelled</span>
          </div>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: hoveredPoint ? 'pointer' : 'default' }}
      />
    </div>
  );
};

export default MonthlyChart;
