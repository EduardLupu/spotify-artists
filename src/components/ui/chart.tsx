import * as React from "react"
import { type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// Chart.js re-exports
export {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts"

// Chart config type
export type ChartConfig = {
  [k in string]: {
    label: string
    color?: string
  }
}

// Chart tooltip - use Tooltip directly from recharts

export const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    hideLabel?: boolean
    hideIndicator?: boolean
    indicator?: "line" | "dot" | "dashed"
    nameKey?: string
    labelKey?: string
    active?: boolean
    payload?: any[]
    label?: any
    labelFormatter?: (value: any, payload: any[]) => string
  }
>(
  (
    {
      className,
      active,
      payload,
      hideLabel = false,
      hideIndicator = false,
      indicator = "dot",
      label,
      labelFormatter,
      nameKey,
      labelKey,
      style,
      ...props
    },
    ref
  ) => {
    // Ignore unsupported tooltip props coming from Recharts
    void props

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length) {
        return null
      }
      const [item] = payload
      const key = `${labelKey || item.dataKey || item.name || "value"}`
      return labelFormatter ? labelFormatter(label, payload) : key
    }, [
      label,
      labelFormatter,
      payload,
      hideLabel,
      labelKey,
    ])

    if (!active || !payload?.length) {
      return null
    }

    const [item] = payload

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
          className
        )}
        style={style}
      >
        {!hideLabel && tooltipLabel && (
          <div className="grid gap-1.5">
            <div className="flex items-center gap-2 font-medium">
              {!hideIndicator && (
                <div
                  className={cn(
                    "h-2.5 w-2.5 shrink-0 rounded-full border-2 border-background",
                    indicator === "dot" && "bg-foreground",
                    indicator === "line" && "bg-foreground",
                    indicator === "dashed" && "bg-foreground"
                  )}
                  style={{
                    backgroundColor: item.color,
                  }}
                />
              )}
              {tooltipLabel}
            </div>
          </div>
        )}
        <div className="grid gap-1.5">
          {payload.map((item, index) => (
            <div
              key={item.dataKey}
              className="flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground"
            >
              {!hideIndicator && (
                <div
                  className="h-2.5 w-2.5 shrink-0 rounded-[2px] border-2 border-background"
                  style={{
                    backgroundColor: item.color,
                  }}
                />
              )}
              <div className="flex w-full flex-1 items-center justify-between gap-2">
                <div className="grid gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {item.name || nameKey}
                    </span>
                  </div>
                </div>
                {item.value && (
                  <div className="font-mono font-medium tabular-nums text-foreground">
                    {item.value}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
)
ChartTooltipContent.displayName = "ChartTooltipContent"

// Chart legend
export const ChartLegend = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    hideIcon?: boolean
    nameKey?: string
    payload?: any[]
    verticalAlign?: "top" | "bottom"
    align?: "left" | "center" | "right"
  }
>(
  (
    {
      className,
      hideIcon = false,
      nameKey,
      payload,
      verticalAlign = "bottom",
      align = "center",
      ...props
    },
    ref
  ) => {
    if (!payload?.length) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center gap-4",
          verticalAlign === "top" ? "pb-3" : "pt-3",
          className
        )}
        {...props}
      >
        {payload.map((item, index) => (
          <div
            key={item.dataKey}
            className="flex items-center gap-1.5 text-xs"
          >
            {!hideIcon && (
              <div
                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{
                  backgroundColor: item.color,
                }}
              />
            )}
            <span className="text-muted-foreground">
              {item.name || nameKey}
            </span>
          </div>
        ))}
      </div>
    )
  }
)
ChartLegend.displayName = "ChartLegend"

export const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    hideIcon?: boolean
    nameKey?: string
    payload?: any[]
  }
>(
  (
    {
      className,
      hideIcon = false,
      nameKey,
      payload,
      ...props
    },
    ref
  ) => {
    if (!payload?.length) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn("flex items-center justify-center gap-4", className)}
        {...props}
      >
        {payload.map((item, index) => (
          <div
            key={item.dataKey}
            className="flex items-center gap-1.5 text-xs"
          >
            {!hideIcon && (
              <div
                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{
                  backgroundColor: item.color,
                }}
              />
            )}
            <span className="text-muted-foreground">
              {item.name || nameKey}
            </span>
          </div>
        ))}
      </div>
    )
  }
)
ChartLegendContent.displayName = "ChartLegendContent"

// Chart container
export const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig
  }
>(({ className, children, config, ...props }, ref) => {
  const chartStyles = React.useMemo(() => {
    return Object.values(config).reduce((acc, value, index) => {
      const position = index + 1
      const cssVariable = `--chart-${position}` as keyof React.CSSProperties
      // @ts-ignore
        acc[cssVariable] = value.color || `hsl(var(--chart-${position}))`
      return acc
    }, {} as React.CSSProperties)
  }, [config])

  return (
    <div
      ref={ref}
      className={cn("w-full", className)}
      style={
        {
          "--chart-1": "hsl(12, 76%, 61%)",
          "--chart-2": "hsl(173, 58%, 39%)",
          "--chart-3": "hsl(197, 37%, 24%)",
          "--chart-4": "hsl(43, 74%, 66%)",
          "--chart-5": "hsl(27, 87%, 67%)",
          ...chartStyles,
        } as React.CSSProperties
      }
      {...props}
    >
      {children}
    </div>
  )
})
ChartContainer.displayName = "ChartContainer"

// Chart style
export const ChartStyle = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "flex h-10 w-full items-center justify-center border border-dashed border-border/50 text-xs text-muted-foreground",
        className
      )}
      {...props}
    />
  )
})
ChartStyle.displayName = "ChartStyle"

// Chart error
export const ChartError = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    icon?: LucideIcon
  }
>(({ className, icon: Icon, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "flex h-10 w-full items-center justify-center text-xs text-muted-foreground",
        className
      )}
      {...props}
    >
      {Icon && <Icon className="mr-2 h-4 w-4" />}
      Chart unavailable
    </div>
  )
})
ChartError.displayName = "ChartError"

// Chart loading
export const ChartLoading = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "flex h-10 w-full items-center justify-center text-xs text-muted-foreground",
        className
      )}
      {...props}
    >
      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      Loading chart...
    </div>
  )
})
ChartLoading.displayName = "ChartLoading"
