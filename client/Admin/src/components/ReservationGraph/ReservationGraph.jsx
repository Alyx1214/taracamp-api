import React from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  CategoryScale,
  LinearScale,
} from "chart.js";

ChartJS.register(Title, Tooltip, Legend, LineElement, CategoryScale, LinearScale);

const ReservationGraph = () => {
  const data = {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    datasets: [
      {
        label: "Completed",
        data: [20, 30, 40, 50, 60, 40, 50, 60, 70, 40, 30, 20],
        borderColor: "green",
        backgroundColor: "rgba(0,255,0,0.2)",
        fill: true,
      },
      {
        label: "Cancelled",
        data: [10, 20, 30, 40, 30, 20, 30, 20, 10, 20, 30, 10],
        borderColor: "red",
        backgroundColor: "rgba(255,0,0,0.2)",
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    scales: {
      x: {
        grid: {
          display: false,
        },
      },
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="reservation-graph">
      <h3>Monthly Reservations</h3>
      <Line data={data} options={options} />
    </div>
  );
};

export default ReservationGraph;
