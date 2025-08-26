import { useEffect, useRef, useState, useCallback } from 'react';
import styles from './MonthlyChart.module.css';

const MonthlyChart = () => {
  const canvasRef = useRef(null);
  const [selectedYear, setSelectedYear] = useState('2024');
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [animationProgress, setAnimationProgress] = useState(0);

  // Static data for different years
  const chartData = {
    2023: {
      completed: [25, 40, 30, 45, 55, 65, 50, 60, 40, 35, 30, 25],
      cancelled: [10, 15, 20, 25, 30, 35, 30, 40, 35, 25, 20, 15]
    },
    2024: {
      completed: [30, 45, 35, 50, 60, 70, 55, 65, 45, 40, 35, 30],
      cancelled: [15, 20, 25, 30, 35, 40, 35, 45, 40, 30, 25, 20]
    },
    2025: {
      completed: [35, 50, 40, 55, 65, 75, 60, 70, 50, 45, 40, 35],
      cancelled: [20, 25, 30, 35, 40, 45, 40, 50, 45, 35, 30, 25]
    }
  };

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Get current year data
    const completedData = chartData[selectedYear].completed;
    const cancelledData = chartData[selectedYear].cancelled;
    
    const maxValue = Math.max(...completedData, ...cancelledData) + 10;
    const chartHeight = height - 80;
    const chartWidth = width - 100;
    const startX = 50;
    const startY = height - 50;
    const stepX = chartWidth / (months.length - 1);
    
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
      
      // Draw Y-axis labels
      ctx.fillStyle = '#9ca3af';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'right';
      const labelValue = Math.round((i * maxValue) / 5);
      ctx.fillText(labelValue.toString(), startX - 10, y + 3);
    }
    
    // Animate data points based on animation progress
    const animatedCompletedData = completedData.map(value => value * animationProgress);
    const animatedCancelledData = cancelledData.map(value => value * animationProgress);
    
    // Draw completed area and line (green)
    if (animationProgress > 0) {
      ctx.strokeStyle = '#22c55e';
      ctx.fillStyle = 'rgba(34, 197, 94, 0.1)';
      ctx.lineWidth = 3;
      
      // Draw area fill
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      animatedCompletedData.forEach((value, index) => {
        const x = startX + index * stepX;
        const y = startY - (value / maxValue) * chartHeight;
        ctx.lineTo(x, y);
      });
      ctx.lineTo(startX + chartWidth, startY);
      ctx.closePath();
      ctx.fill();
      
      // Draw line
      ctx.beginPath();
      animatedCompletedData.forEach((value, index) => {
        const x = startX + index * stepX;
        const y = startY - (value / maxValue) * chartHeight;
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
      
      // Draw data points
      animatedCompletedData.forEach((value, index) => {
        const x = startX + index * stepX;
        const y = startY - (value / maxValue) * chartHeight;
        
        ctx.beginPath();
        ctx.arc(x, y, hoveredPoint?.type === 'completed' && hoveredPoint?.index === index ? 6 : 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#22c55e';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }
    
    // Draw cancelled line (orange)
    if (animationProgress > 0) {
      ctx.strokeStyle = '#f97316';
      ctx.fillStyle = 'rgba(249, 115, 22, 0.1)';
      ctx.lineWidth = 3;
      
      ctx.beginPath();
      animatedCancelledData.forEach((value, index) => {
        const x = startX + index * stepX;
        const y = startY - (value / maxValue) * chartHeight;
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
      
      // Draw data points
      animatedCancelledData.forEach((value, index) => {
        const x = startX + index * stepX;
        const y = startY - (value / maxValue) * chartHeight;
        
        ctx.beginPath();
        ctx.arc(x, y, hoveredPoint?.type === 'cancelled' && hoveredPoint?.index === index ? 6 : 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#f97316';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }
    
    // Draw month labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    
    months.forEach((month, index) => {
      const x = startX + index * stepX;
      ctx.fillText(month, x, startY + 20);
    });
    
    // Draw tooltip if hovering
    if (hoveredPoint && animationProgress > 0) {
      const { type, index, x, y } = hoveredPoint;
      const completedValue = completedData[index];
      const cancelledValue = cancelledData[index];
      
      // Tooltip background
      const tooltipText = `${months[index]}: Completed: ${completedValue}, Cancelled: ${cancelledValue}`;
      ctx.font = '12px Inter, sans-serif';
      const textMetrics = ctx.measureText(tooltipText);
      const tooltipWidth = textMetrics.width + 16;
      const tooltipHeight = 40;
      
      let tooltipX = x - tooltipWidth / 2;
      let tooltipY = y - tooltipHeight - 10;
      
      // Keep tooltip in bounds
      if (tooltipX < 10) tooltipX = 10;
      if (tooltipX + tooltipWidth > width - 10) tooltipX = width - tooltipWidth - 10;
      if (tooltipY < 10) tooltipY = y + 20;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
      
      // Tooltip text
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(`${months[index]}`, tooltipX + 8, tooltipY + 16);
      ctx.fillText(`Completed: ${completedValue}`, tooltipX + 8, tooltipY + 32);
      ctx.fillText(`Cancelled: ${cancelledValue}`, tooltipX + 80, tooltipY + 32);
    }
  }, [selectedYear, hoveredPoint, animationProgress, chartData]);

  // Animation effect
  useEffect(() => {
    let animationFrame;
    let startTime;
    
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const duration = 1500; // 1.5 seconds
      
      const progress = Math.min(elapsed / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      
      setAnimationProgress(easeOutQuart);
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    
    setAnimationProgress(0);
    animationFrame = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [selectedYear]);

  // Draw chart whenever dependencies change
  useEffect(() => {
    drawChart();
  }, [drawChart]);

  // Handle mouse events for interactivity
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
    
    const completedData = chartData[selectedYear].completed;
    const cancelledData = chartData[selectedYear].cancelled;
    const maxValue = Math.max(...completedData, ...cancelledData) + 10;
    
    let closestPoint = null;
    let minDistance = Infinity;
    
    // Check completed points
    completedData.forEach((value, index) => {
      const x = startX + index * stepX;
      const y = startY - (value / maxValue) * chartHeight;
      const distance = Math.sqrt(Math.pow(mouseX - x, 2) + Math.pow(mouseY - y, 2));
      
      if (distance < 15 && distance < minDistance) {
        minDistance = distance;
        closestPoint = { type: 'completed', index, x, y };
      }
    });
    
    // Check cancelled points
    cancelledData.forEach((value, index) => {
      const x = startX + index * stepX;
      const y = startY - (value / maxValue) * chartHeight;
      const distance = Math.sqrt(Math.pow(mouseX - x, 2) + Math.pow(mouseY - y, 2));
      
      if (distance < 15 && distance < minDistance) {
        minDistance = distance;
        closestPoint = { type: 'cancelled', index, x, y };
      }
    });
    
    setHoveredPoint(closestPoint);
  }, [selectedYear, chartData]);

  const handleMouseLeave = useCallback(() => {
    setHoveredPoint(null);
  }, []);

  const handleYearChange = (event) => {
    setSelectedYear(event.target.value);
  };

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
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: hoveredPoint ? 'pointer' : 'default' }}
      />
      <div className={styles.yearSelector}>
        <select 
          className={styles.yearSelect}
          value={selectedYear}
          onChange={handleYearChange}
        >
          <option value="2023">2023</option>
          <option value="2024">2024</option>
          <option value="2025">2025</option>
        </select>
      </div>
    </div>
  );
};

export default MonthlyChart;
