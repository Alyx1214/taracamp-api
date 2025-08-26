import { useEffect, useRef } from 'react';
import styles from './MonthlyChart.module.css';

const MonthlyChart = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Sample data for the chart
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const completedData = [30, 45, 35, 50, 60, 70, 55, 65, 45, 40, 35, 30];
    const cancelledData = [15, 20, 25, 30, 35, 40, 35, 45, 40, 30, 25, 20];
    
    const maxValue = Math.max(...completedData, ...cancelledData) + 10;
    const chartHeight = height - 80;
    const chartWidth = width - 100;
    const startX = 50;
    const startY = height - 50;
    
    // Draw grid lines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = startY - (i * chartHeight / 5);
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX + chartWidth, y);
      ctx.stroke();
    }
    
    // Draw completed line (green)
    ctx.strokeStyle = '#22c55e';
    ctx.fillStyle = 'rgba(34, 197, 94, 0.1)';
    ctx.lineWidth = 3;
    
    ctx.beginPath();
    const stepX = chartWidth / (months.length - 1);
    
    // Draw area fill for completed
    ctx.moveTo(startX, startY);
    completedData.forEach((value, index) => {
      const x = startX + index * stepX;
      const y = startY - (value / maxValue) * chartHeight;
      if (index === 0) {
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.lineTo(startX + chartWidth, startY);
    ctx.closePath();
    ctx.fill();
    
    // Draw completed line
    ctx.beginPath();
    completedData.forEach((value, index) => {
      const x = startX + index * stepX;
      const y = startY - (value / maxValue) * chartHeight;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    
    // Draw cancelled line (orange)
    ctx.strokeStyle = '#f97316';
    ctx.fillStyle = 'rgba(249, 115, 22, 0.1)';
    
    ctx.beginPath();
    cancelledData.forEach((value, index) => {
      const x = startX + index * stepX;
      const y = startY - (value / maxValue) * chartHeight;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    
    // Draw month labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    
    months.forEach((month, index) => {
      const x = startX + index * stepX;
      ctx.fillText(month, x, startY + 20);
    });
    
  }, []);

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>Monthly Reservations</h3>
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <div className={`${styles.legendDot} ${styles.completed}`}></div>
            <span>Completed</span>
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
      />
      <div className={styles.yearSelector}>
        <select className={styles.yearSelect}>
          <option value="2023">2023</option>
          <option value="2024">2024</option>
          <option value="2025">2025</option>
        </select>
      </div>
    </div>
  );
};

export default MonthlyChart;
