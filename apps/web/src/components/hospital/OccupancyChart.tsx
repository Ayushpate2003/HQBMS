'use client'

import ReactECharts from 'echarts-for-react'
import { useBeds } from '@/hooks/useBeds'
import { useMemo } from 'react'

export default function OccupancyChart({ unitId }: { unitId: string }) {
    const { beds, loading } = useBeds(unitId)

    const option = useMemo(() => {
        let free = 0;
        let occupied = 0;
        let blocked = 0;

        beds.forEach(b => {
            if (b.status === 'free') free++;
            else if (b.status === 'occupied') occupied++;
            else if (b.status === 'blocked') blocked++;
        });

        return {
            title: {
                text: 'Unit Occupancy',
                left: 'center',
                top: 'middle',
                textStyle: {
                    fontSize: 18,
                    fontWeight: 'normal',
                    color: '#374151'
                }
            },
            tooltip: {
                trigger: 'item'
            },
            legend: {
                orient: 'vertical',
                left: 'left',
            },
            color: ['#10b981', '#f43f5e', '#f59e0b'], // Emerald, Rose, Amber corresponding to BedGrid
            series: [
                {
                    name: 'Bed Status',
                    type: 'pie',
                    radius: ['50%', '80%'],
                    avoidLabelOverlap: false,
                    label: {
                        show: false,
                        position: 'center'
                    },
                    emphasis: {
                        label: {
                            show: true,
                            fontSize: '24',
                            fontWeight: 'bold'
                        }
                    },
                    labelLine: {
                        show: false
                    },
                    data: [
                        { value: free, name: 'Free' },
                        { value: occupied, name: 'Occupied' },
                        { value: blocked, name: 'Blocked' }
                    ]
                }
            ]
        }
    }, [beds])

    if (loading) {
        return <div className="animate-pulse bg-gray-200 h-[300px] rounded-xl w-full"></div>
    }

    return (
        <div className="w-full h-[300px] bg-white rounded-xl shadow-sm border p-4">
            <ReactECharts
                option={option}
                style={{ height: '100%', width: '100%' }}
                opts={{ renderer: 'svg' }}
            />
        </div>
    )
}
