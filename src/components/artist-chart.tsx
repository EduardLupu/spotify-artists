"use client"

import * as React from "react"
import {Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer} from "recharts"

import {Card, CardContent, CardDescription, CardHeader} from "@/components/ui/card"
import {type ChartConfig, ChartContainer, ChartTooltipContent} from "@/components/ui/chart"
import {cn} from "@/lib/utils"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Switch} from "@/components/ui/switch"
import {Label} from "@/components/ui/label"

interface ArtistChartProps {
    seriesData?: {
        fields: string[]
        rows: any[][]
        b?: string
        step?: string
    }
    artistName: string
}

type ChartPoint = {
    date: string
    monthlyListeners?: number
    followers?: number
    rank?: number
    newMonthlyListeners?: number
    newFollowers?: number
    newRank?: number
}

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
})

const thousandNumberFormatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
})

const audienceChartConfig = {
    monthlyListeners: {
        label: "Listeners",
        color: "#1DB954",
    },
    followers: {
        label: "Followers",
        color: "#b91d82",
    },
    newMonthlyListeners: {
        label: "New Listeners",
        color: "#1DB954",
    },
    newFollowers: {
        label: "New Followers",
        color: "#b91d82",
    },
} satisfies ChartConfig

const rankChartConfig = {
    rank: {
        label: "Rank",
        color: "#1DB954",
    },
    newRank: {
        label: "Rank Change",
        color: "#1DB954",
    },
} satisfies ChartConfig

export function ArtistChart({seriesData, artistName}: ArtistChartProps) {
    const [timeRange, setTimeRange] = React.useState("30d")
    const [metricTab, setMetricTab] = React.useState<"audience" | "rank">("audience")
    const [showUnique, setShowUnique] = React.useState(false)

    const chartTabs = React.useMemo(
        () => [
            {
                value: "audience" as const,
                label: "Audience",
                subtitle: "Listeners vs Followers",
            },
            {
                value: "rank" as const,
                label: "Rank",
                subtitle: "Global chart position",
            },
        ],
        [],
    )

    const formatShortDate = React.useCallback((value: string) => {
        return new Date(value).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        })
    }, [])

    const formatMetricValue = React.useCallback((value: number) => {
        const absValue = Math.abs(value)
        if (absValue >= 1_000_000) {
            return compactNumberFormatter.format(value)
        }
        if (absValue >= 1_000) {
            return thousandNumberFormatter.format(Math.round(value))
        }
        return Number.isInteger(value) ? value.toString() : value.toFixed(1)
    }, [])

    const chartData = React.useMemo<ChartPoint[]>(() => {
        if (!seriesData) return []

        const {fields, rows, b: baseDate} = seriesData
        const base = baseDate ? new Date(baseDate) : null
        const dateFieldIndex = fields.indexOf("d")

        const processedData = rows
            .map((row, index) => {
                let isoDate: string | null = null

                if (dateFieldIndex !== -1 && dateFieldIndex < row.length) {
                    const rawDate = row[dateFieldIndex]
                    if (typeof rawDate === "string") {
                        const parsed = new Date(rawDate)
                        if (!Number.isNaN(parsed.getTime())) {
                            isoDate = parsed.toISOString().split("T")[0]
                        }
                    }
                }

                if (!isoDate && base instanceof Date && !Number.isNaN(base.getTime())) {
                    const computed = new Date(base)
                    computed.setDate(computed.getDate() + index)
                    isoDate = computed.toISOString().split("T")[0]
                }

                if (!isoDate) {
                    return null
                }

                const data: ChartPoint = {date: isoDate}

                fields.forEach((field, fieldIndex) => {
                    if (fieldIndex >= row.length) return
                    const rawValue = row[fieldIndex]
                    if (rawValue === null || rawValue === undefined || rawValue === "") {
                        return
                    }

                    const numericValue = Number(rawValue)
                    if (!Number.isFinite(numericValue)) {
                        return
                    }

                    switch (field) {
                        case "r":
                            data.rank = numericValue
                            break
                        case "ml":
                            data.monthlyListeners = numericValue
                            break
                        case "f":
                            data.followers = numericValue
                            break
                    }
                })

                return data
            })
            .filter((point): point is ChartPoint => point !== null)

        // Calculate unique/new values (deltas between consecutive points)
        for (let i = 1; i < processedData.length; i++) {
            const current = processedData[i]
            const previous = processedData[i - 1]

            if (current.monthlyListeners !== undefined && previous.monthlyListeners !== undefined) {
                current.newMonthlyListeners = current.monthlyListeners - previous.monthlyListeners
            }

            if (current.followers !== undefined && previous.followers !== undefined) {
                current.newFollowers = current.followers - previous.followers
            }

            if (current.rank !== undefined && previous.rank !== undefined) {
                current.newRank = previous.rank - current.rank // Inverted because lower rank is better
            }
        }

        return processedData
    }, [seriesData])

    const filteredData = React.useMemo(() => {
        if (!chartData.length) return []

        const referenceDate = new Date(chartData[chartData.length - 1]?.date || new Date())
        let daysToSubtract = 30

        if (timeRange === "7d") {
            daysToSubtract = 7
        } else if (timeRange === "14d") {
            daysToSubtract = 14
        } else if (timeRange === "90d") {
            daysToSubtract = 90
        } else if (timeRange === "all") {
            return chartData
        }

        const startDate = new Date(referenceDate)
        startDate.setDate(startDate.getDate() - daysToSubtract)

        return chartData.filter((item) => {
            const date = new Date(item.date)
            return date >= startDate
        })
    }, [chartData, timeRange])

    const tooltipValueFormatter = React.useCallback((value: number | string) => {
        const numericValue = typeof value === "number" ? value : Number.parseFloat(String(value))
        if (!Number.isFinite(numericValue)) {
            return value?.toString?.() ?? ""
        }
        const absValue = Math.abs(numericValue)
        if (absValue >= 1_000_000) {
            return compactNumberFormatter.format(numericValue)
        }
        if (absValue >= 1_000) {
            return thousandNumberFormatter.format(Math.round(numericValue))
        }
        return Number.isInteger(numericValue) ? numericValue.toString() : numericValue.toFixed(1)
    }, [])

    const latestSummary = React.useMemo(() => {
        if (!filteredData.length) return null

        const latest = filteredData[filteredData.length - 1]
        const previous = filteredData.length > 1 ? filteredData[filteredData.length - 2] : undefined

        if (metricTab === "audience") {
            const parts: string[] = []

            if (showUnique) {
                if (typeof latest.newMonthlyListeners === "number") {
                    const value = tooltipValueFormatter(latest.newMonthlyListeners)
                    const sign = latest.newMonthlyListeners >= 0 ? "+" : ""
                    parts.push(`${sign}${value} listeners`)
                }
                if (typeof latest.newFollowers === "number") {
                    const value = tooltipValueFormatter(latest.newFollowers)
                    const sign = latest.newFollowers >= 0 ? "+" : ""
                    parts.push(`${sign}${value} followers`)
                }
            } else {
                if (typeof latest.monthlyListeners === "number") {
                    const latestValue = tooltipValueFormatter(latest.monthlyListeners)
                    let delta: string | null = null

                    if (previous && typeof previous.monthlyListeners === "number") {
                        const diff = latest.monthlyListeners - previous.monthlyListeners
                        if (diff !== 0) {
                            const formattedDiff = tooltipValueFormatter(Math.abs(diff))
                            const direction = diff > 0 ? "+" : "-"
                            delta = `${direction}${formattedDiff}`
                        }
                    }

                    parts.push(`${latestValue} listeners${delta ? ` (${delta})` : ""}`)
                }

                if (typeof latest.followers === "number") {
                    const latestValue = tooltipValueFormatter(latest.followers)
                    let delta: string | null = null

                    if (previous && typeof previous.followers === "number") {
                        const diff = latest.followers - previous.followers
                        if (diff !== 0) {
                            const formattedDiff = tooltipValueFormatter(Math.abs(diff))
                            const direction = diff > 0 ? "+" : "-"
                            delta = `${direction}${formattedDiff}`
                        }
                    }
                    parts.push(`${latestValue} followers${delta ? ` (${delta})` : ""}`)
                }
            }

            return parts.length ? parts.join(" · ") : null
        }

        if (metricTab === "rank" && typeof latest.rank === "number") {
            const latestRank = thousandNumberFormatter.format(Math.round(latest.rank))
            let diffText: string | null = null

            if (previous && typeof previous.rank === "number") {
                const diff = previous.rank - latest.rank
                if (diff !== 0) {
                    const direction = diff > 0 ? "+" : ""
                    diffText = `${direction}${diff}`
                }
            }

            return diffText ? `Rank #${latestRank} (${diffText})` : `Rank #${latestRank}`
        }

        return null
    }, [filteredData, metricTab, tooltipValueFormatter, showUnique])

    const activeTab = React.useMemo(() => chartTabs.find((tab) => tab.value === metricTab), [chartTabs, metricTab])

    const hasAudienceData = React.useMemo(
        () => filteredData.some((item) => typeof item.monthlyListeners === "number" || typeof item.followers === "number"),
        [filteredData],
    )

    const hasRankData = React.useMemo(() => filteredData.some((item) => typeof item.rank === "number"), [filteredData])

    const activeConfig = metricTab === "audience" ? audienceChartConfig : rankChartConfig

    const emptyState = (
        <div className="flex h-[300px] w-full items-center justify-center text-sm text-muted-foreground">
            No data available
        </div>
    )

    if (!seriesData || !chartData.length) {
        return (
            <Card className="border-border/40 bg-card/50 backdrop-blur">
                <CardHeader className="border-b border-border/40 pb-4">
                    <CardDescription>No historical data available for {artistName}</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">{emptyState}</CardContent>
            </Card>
        )
    }

    return (
        <Card className="border-border/40 bg-card/50 backdrop-blur">
            <CardHeader className="border-b border-border/40 pb-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 space-y-2">
                        <CardDescription className="text-sm">
                            {activeTab?.subtitle
                                ? `${activeTab.subtitle} for ${artistName}`
                                : `${artistName}'s performance over time`}
                        </CardDescription>
                        {latestSummary && (
                            <div
                                className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                                {latestSummary}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-3 sm:items-end">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <Switch id="unique-mode" checked={showUnique} onCheckedChange={setShowUnique}/>
                                <Label htmlFor="unique-mode" className="text-xs font-medium cursor-pointer">
                                    Show New
                                </Label>
                            </div>

                            <Select value={timeRange} onValueChange={setTimeRange}>
                                <SelectTrigger className="w-[130px] h-9 text-xs" aria-label="Select time range">
                                    <SelectValue placeholder="Last 30 days"/>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="7d">Last 7 days</SelectItem>
                                    <SelectItem value="14d">Last 14 days</SelectItem>
                                    <SelectItem value="30d">Last 30 days</SelectItem>
                                    <SelectItem value="90d">Last 90 days</SelectItem>
                                    <SelectItem value="all">All time</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-1 rounded-lg border border-border/40 bg-muted/30 p-1">
                            {chartTabs.map((tab) => (
                                <button
                                    key={tab.value}
                                    type="button"
                                    onClick={() => setMetricTab(tab.value)}
                                    className={cn(
                                        "rounded-md px-3 py-1 text-xs font-medium transition-all",
                                        metricTab === tab.value
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground",
                                    )}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-6">
                {metricTab === "audience" ? (
                    hasAudienceData ? (
                        <ChartContainer
                            config={activeConfig}
                            className="h-[240px] w-full sm:h-[280px] lg:h-[320px]"
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart
                                    data={filteredData}
                                    margin={{left: -12, right: 16, top: 12, bottom: 0}}
                                >
                                    <defs>
                                        <linearGradient id="fillMonthlyListeners" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#1DB954" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#1DB954" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="fillFollowers" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#b91d82" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#b91d82" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="fillNewMonthlyListeners" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#1DB954" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#1DB954" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="fillNewFollowers" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#b91d82" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#b91d82" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))"
                                                   opacity={0.3}/>
                                    <XAxis
                                        dataKey="date"
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        minTickGap={28}
                                        tickFormatter={formatShortDate}
                                        tick={{fill: "hsl(var(--muted-foreground))", fontSize: 10}}
                                    />
                                    <YAxis
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={6}
                                        width={44}
                                        tick={{fill: "hsl(var(--muted-foreground))", fontSize: 10}}
                                        tickFormatter={(value) => formatMetricValue(Number(value))}
                                    />
                                    <Tooltip
                                        cursor={{stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "4 4"}}
                                        content={
                                            <ChartTooltipContent
                                                labelFormatter={(value) => formatShortDate(value as string)}
                                                indicator="dot"
                                            />
                                        }
                                    />
                                    {filteredData.some((d) =>
                                        showUnique ? d.newMonthlyListeners !== undefined : d.monthlyListeners !== undefined,
                                    ) && (
                                        <Area
                                            dataKey={showUnique ? "newMonthlyListeners" : "monthlyListeners"}
                                            name={
                                                showUnique
                                                    ? audienceChartConfig.newMonthlyListeners.label
                                                    : audienceChartConfig.monthlyListeners.label
                                            }
                                            type="natural"
                                            fill="url(#fillMonthlyListeners)"
                                            stroke="#1DB954"
                                            strokeWidth={2}
                                            dot={false}
                                            activeDot={{r: 4, fill: "#1DB954", strokeWidth: 0}}
                                        />
                                    )}
                                    {filteredData.some((d) =>
                                        showUnique ? d.newFollowers !== undefined : d.followers !== undefined,
                                    ) && (
                                        <Area
                                            dataKey={showUnique ? "newFollowers" : "followers"}
                                            name={showUnique ? audienceChartConfig.newFollowers.label : audienceChartConfig.followers.label}
                                            type="natural"
                                            fill="url(#fillFollowers)"
                                            stroke="#b91d82"
                                            strokeWidth={2}
                                            dot={false}
                                            activeDot={{r: 4, fill: "#b91d82", strokeWidth: 0}}
                                        />
                                    )}
                                </AreaChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    ) : (
                        emptyState
                    )
                ) : hasRankData ? (
                    <ChartContainer
                        config={activeConfig}
                        className="h-[240px] w-full sm:h-[280px] lg:h-[320px]"
                    >
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={filteredData}
                                margin={{left: -12, right: 16, top: 12, bottom: 0}}
                            >
                                <defs>
                                    <linearGradient id="fillRank" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#1DB954" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#1DB954" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="fillNewRank" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#1DB954" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#1DB954" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))"
                                               opacity={0.3}/>
                                <XAxis
                                    dataKey="date"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    minTickGap={28}
                                    tickFormatter={formatShortDate}
                                    tick={{fill: "hsl(var(--muted-foreground))", fontSize: 10}}
                                />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={6}
                                    width={44}
                                    allowDecimals={false}
                                    reversed={!showUnique}
                                    tickFormatter={(value) => `#${thousandNumberFormatter.format(Math.round(Number(value)))}`}
                                    tick={{fill: "hsl(var(--muted-foreground))", fontSize: 10}}
                                />
                                <Tooltip
                                    cursor={{stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "4 4"}}
                                    formatter={(value: number | string) => [
                                        `#${thousandNumberFormatter.format(Math.round(Number(value)))}`,
                                        showUnique ? "Rank Change" : "Rank",
                                    ]}
                                    content={
                                        <ChartTooltipContent
                                            labelFormatter={(value) => formatShortDate(value as string)}
                                            indicator="dot"
                                        />
                                    }
                                />
                                {!showUnique && (
                                    <Area
                                        dataKey="rank"
                                        name={rankChartConfig.rank.label}
                                        type="natural"
                                        fill="url(#fillRank)"
                                        stroke="#1DB954"
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{r: 4, fill: "#1DB954", strokeWidth: 0}}
                                    />
                                )}
                                {showUnique && filteredData.some((d) => d.newRank !== undefined) && (
                                    <Area
                                        dataKey="newRank"
                                        name={rankChartConfig.newRank.label}
                                        type="natural"
                                        fill="url(#fillNewRank)"
                                        stroke="#1DB954"
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{r: 4, fill: "#1DB954", strokeWidth: 0}}
                                    />
                                )}
                            </AreaChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                ) : (
                    emptyState
                )}
            </CardContent>
        </Card>
    )
}
