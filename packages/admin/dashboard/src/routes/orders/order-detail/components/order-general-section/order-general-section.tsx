import { XCircle } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import {
  Container,
  Copy,
  Heading,
  StatusBadge,
  Text,
  toast,
  Button,
  Select,
  Drawer,
  Input,
  Label,
} from "@medusajs/ui"
import { useTranslation } from "react-i18next"
import { ActionMenu } from "../../../../../components/common/action-menu"
import { useDate } from "../../../../../hooks/use-date"
import {
  getCanceledOrderStatus,
  getOrderFulfillmentStatus,
  getOrderPaymentStatus,
} from "../../../../../lib/order-helpers"
import { useState, useEffect } from "react"
import { sdk } from "../../../../../lib/client"
import { useMutation } from "@tanstack/react-query"
import { queryClient } from "../../../../../lib/query-client"
import { ordersQueryKeys } from "../../../../../hooks/api"

type OrderGeneralSectionProps = {
  order: HttpTypes.AdminOrder
}

// 不同意的理由选项
const rejectCancelReasons = [
  { value: "ITEM_IN_PRODUCTION", label: "商品制作中" },
  { value: "ITEM_PURCHASED_OR_SHIPPING", label: "商品已代购完成或运送中" },
  { value: "ITEM_SHIPPED", label: "商品已出货" },
  { value: "ORDER_NOT_CANCELLED_BY_AGREEMENT", label: "双方协议不取消交易" },
  { value: "OTHER_REASON", label: "其他原因" },
]

// 取消订单的理由选项
const applyCancelReasons = [
  { value: "ITEM_DEFECTIVE_OR_LOST", label: "有瑕疵或已遗失无法进行交易" },
  { value: "BUYER_UNREACHABLE", label: "无法联系上买家或买家不回应" },
  { value: "ORDER_CANCELLED_BY_AGREEMENT", label: "双方协调决定取消交易" },
  { value: "SELLER_OUT_OF_STOCK", label: "卖家缺货" },
  { value: "OTHER_REASON", label: "其他原因" },
]

export const OrderGeneralSection = ({ order }: OrderGeneralSectionProps) => {
  const { t } = useTranslation()
  const { getFullDate } = useDate()
  const [rejectCancelReason, setRejectCancelReason] = useState<string>("")
  const [showRejectCancelDrawer, setShowRejectCancelDrawer] = useState(false)
  const [applyCancelReason, setApplyCancelReason] = useState<string>("")
  const [showApplyCancelDrawer, setShowApplyCancelDrawer] = useState(false)
  const [isBuyerApplyCancelOrder, setBuyerApplyCancelOrder] = useState(false)
  const [otherReason, setOtherReason] = useState("")

  // Select 开关状态控制
  const [applyCancelSelectOpen, setApplyCancelSelectOpen] = useState(false)
  const [rejectCancelSelectOpen, setRejectCancelSelectOpen] = useState(false)

  const orderWithRutenStatus = order as HttpTypes.AdminOrder & {
    ruten_order: {
      status: string,
      metadata: Record<string, unknown>,
    },
    canceled_at: Date | string
  }

  // 处理打开 Drawer 的方法，确保焦点正确转移
  const handleOpenApplyCancelDrawer = () => {
    // 使用 requestAnimationFrame 确保 ActionMenu 关闭后再打开 Drawer
    requestAnimationFrame(() => {
      setShowApplyCancelDrawer(true)
    })
  }

  const handleOpenRejectCancelDrawer = () => {
    // 使用 requestAnimationFrame 确保 ActionMenu 关闭后再打开 Drawer
    requestAnimationFrame(() => {
      setShowRejectCancelDrawer(true)
    })
  }

  // 检查订单状态
  useEffect(() => {
    const rutenOrderIsInCancel = orderWithRutenStatus.ruten_order.status.toUpperCase() === "INCANCEL"
    const orderIsCanceledBySeller = orderWithRutenStatus.metadata?.["cancel_by"] === "seller"
    if (order.status === "requires_action" && rutenOrderIsInCancel && !orderIsCanceledBySeller) {
      setBuyerApplyCancelOrder(true)
    }
  }, [order.id, order.status])

  const { mutateAsync: handleApplyCancel, isPending: isApplyCancelPending } = useMutation({
    mutationFn: () => {
      // 验证"其他原因"的长度
      if (applyCancelReason === "OTHER_REASON" && (!otherReason.trim() || otherReason.trim().length < 2)) {
        throw new Error("其他原因至少需要输入2个字符")
      }

      return sdk.client.fetch(
        `/admin/ruten/order/${order.id}/apply_cancel`,
        {
          method: "POST",
          body: {
            cancel_reason_type: applyCancelReason,
            other_reason: applyCancelReason === "OTHER_REASON" ? otherReason.trim() : undefined
          }
        }
      )
    },
    onSuccess: () => {
      toast.success("申请取消订单成功")
      // 使订单查询失效，重新获取最新状态
      queryClient.invalidateQueries({
        queryKey: ordersQueryKeys.detail(order.id)
      })
    },
    onError: (error) => {
      toast.error(`申请取消订单失败： ${error.message}`)
    }
  })

  const { mutateAsync: handleRejectCancel, isPending: isRejectCancelPending } = useMutation({
    mutationFn: () => {
      // 验证"其他原因"的长度
      if (rejectCancelReason === "OTHER_REASON" && (!otherReason.trim() || otherReason.trim().length < 5)) {
        throw new Error("其他原因至少需要输入5个字符")
      }

      return sdk.client.fetch(
        `/admin/ruten/order/${order.id}/reject_cancel`,
        {
          method: "POST",
          body: {
            reject_reason_type: rejectCancelReason,
            other_reason: rejectCancelReason === "OTHER_REASON" ? otherReason.trim() : undefined
          }
        }
      )
    },
    onSuccess: () => {
      toast.success("拒绝取消订单成功")
      setBuyerApplyCancelOrder(false)
      // 使订单查询失效，重新获取最新状态
      queryClient.invalidateQueries({ queryKey: ["orders", "detail", order.id] })
    },
    onError: (error) => {
      toast.error(`拒绝取消订单失败： ${error.message}`)
    }
  })


  const { mutateAsync: handleAgreeCancel, isPending: isAgreeCancelPending } = useMutation({
    mutationFn: () => {
      return sdk.client.fetch(
        `/admin/ruten/order/${order.id}/agree_cancel`,
        { method: "POST" }
      )
    },
    onSuccess: () => {
      toast.success("同意取消订单成功")
      setBuyerApplyCancelOrder(false)
      // 使订单查询失效，重新获取最新状态
      queryClient.invalidateQueries({ queryKey: ["orders", "detail", order.id] })
    },
    onError: (error) => {
      toast.error(`同意取消订单失败： ${error.message}`)
    }
  })

  return (
    <>
      <Container className="flex items-center justify-between px-6 py-4">
        <div>
          <div className="flex items-center gap-x-1">
            <Heading>#{order.display_id}</Heading>
            <Copy content={`#${order.display_id}`} className="text-ui-fg-muted" />
            {isBuyerApplyCancelOrder && (
              <StatusBadge color="orange" className="ml-2">
                买家申请取消
              </StatusBadge>
            )}
          </div>
          <Text size="small" className="text-ui-fg-subtle">
            {t("orders.onDateFromSalesChannel", {
              date: getFullDate({ date: order.created_at, includeTime: true }),
              salesChannel: order.sales_channel?.name,
            })}
          </Text>
        </div>
        <div className="flex items-center gap-x-4">
          <div className="flex items-center gap-x-1.5">
            <OrderBadge order={order} />
            <PaymentBadge order={order} />
            <FulfillmentBadge order={order} />
          </div>
          <ActionMenu
            groups={[
              {
                actions: isBuyerApplyCancelOrder ? [
                  // 当买家申请取消订单时显示的操作
                  {
                    label: "同意取消订单",
                    onClick: handleAgreeCancel,
                    disabled: isAgreeCancelPending,
                    icon: <XCircle />,
                  },
                  {
                    label: "拒绝取消订单",
                    onClick: handleOpenRejectCancelDrawer,
                    disabled: isRejectCancelPending,
                    icon: <XCircle />,
                  },
                ] : [
                  // 正常状态下显示的操作
                  {
                    label: "申请取消订单",
                    onClick: handleOpenApplyCancelDrawer,
                    disabled: !!orderWithRutenStatus.canceled_at || isApplyCancelPending || order.status === "completed",
                    icon: <XCircle />,
                  },
                ],
              },
            ]}
          />
        </div>
      </Container>

      {/* 申请取消订单弹窗 */}
      <Drawer
        open={showApplyCancelDrawer}
        onOpenChange={setShowApplyCancelDrawer}
      >
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>申请取消订单</Drawer.Title>
            <Drawer.Description>
              请选择取消订单的理由，提交后将向买家发送取消申请。
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body className="space-y-4">
            <div className="space-y-2">
              <Label className="font-medium">取消理由</Label>
              <Select
                value={applyCancelReason}
                onValueChange={(value) => {
                  setApplyCancelReason(value)
                  if (value !== "OTHER_REASON") {
                    setOtherReason("")
                  }
                }}
                open={applyCancelSelectOpen}
                onOpenChange={setApplyCancelSelectOpen}
              >
                <Select.Trigger>
                  <Select.Value placeholder="请选择取消订单的理由" />
                </Select.Trigger>
                <Select.Content
                  position="popper"
                  side="bottom"
                  align="start"
                  sideOffset={4}
                >
                  {applyCancelReasons.map((reason) => (
                    <Select.Item key={reason.value} value={reason.value}>
                      {reason.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            {applyCancelReason === "OTHER_REASON" && (
              <div className="space-y-2">
                <Label className="font-medium">请详细说明理由</Label>
                <Input
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  placeholder="请输入具体的取消理由..."
                  maxLength={100}
                  minLength={2}
                />
                <Text size="small" className="text-ui-fg-subtle">
                  最少2个字符，最多100个字符 ({otherReason.length}/100)
                </Text>
              </div>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex items-center gap-x-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowApplyCancelDrawer(false)
                  setApplyCancelReason("")
                  setOtherReason("")
                }}
                disabled={isApplyCancelPending}
              >
                取消
              </Button>
              <Button
                variant="danger"
                onClick={() => handleApplyCancel().then(() => {
                  // 成功后关闭 Drawer 并重置状态
                  setShowApplyCancelDrawer(false)
                  setApplyCancelReason("")
                  setOtherReason("")
                })}
                disabled={
                  !applyCancelReason ||
                  (applyCancelReason === "OTHER_REASON" && (!otherReason.trim() || otherReason.trim().length < 2)) ||
                  isApplyCancelPending
                }
                isLoading={isApplyCancelPending}
              >
                {isApplyCancelPending ? "提交中..." : "确认申请取消"}
              </Button>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      {/* 拒绝取消订单弹窗 */}
      <Drawer
        open={showRejectCancelDrawer}
        onOpenChange={setShowRejectCancelDrawer}
      >
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>拒绝取消订单</Drawer.Title>
            <Drawer.Description>
              请选择拒绝买家取消订单申请的理由。
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body className="space-y-4">
            <div className="space-y-2">
              <Label className="font-medium">拒绝理由</Label>
              <Select
                value={rejectCancelReason}
                onValueChange={(value) => {
                  setRejectCancelReason(value)
                  if (value !== "OTHER_REASON") {
                    setOtherReason("")
                  }
                }}
                open={rejectCancelSelectOpen}
                onOpenChange={setRejectCancelSelectOpen}
              >
                <Select.Trigger>
                  <Select.Value placeholder="请选择拒绝的理由" />
                </Select.Trigger>
                <Select.Content
                  position="popper"
                  side="bottom"
                  align="start"
                  sideOffset={4}
                >
                  {rejectCancelReasons.map((reason) => (
                    <Select.Item key={reason.value} value={reason.value}>
                      {reason.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            {rejectCancelReason === "OTHER_REASON" && (
              <div className="space-y-2">
                <Label className="font-medium">请详细说明理由</Label>
                <Input
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  placeholder="请输入具体的拒绝理由..."
                  maxLength={100}
                  minLength={2}
                />
                <Text size="small" className="text-ui-fg-subtle">
                  最少2个字符，最多100个字符 ({otherReason.length}/100)
                </Text>
              </div>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex items-center gap-x-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowRejectCancelDrawer(false)
                  setRejectCancelReason("")
                  setOtherReason("")
                }}
                disabled={isRejectCancelPending}
              >
                取消
              </Button>
              <Button
                variant="danger"
                onClick={() => handleRejectCancel().finally(() => {
                  // 成功后关闭 Drawer 并重置状态
                  setShowRejectCancelDrawer(false)
                  setRejectCancelReason("")
                  setOtherReason("")
                })}
                disabled={
                  !rejectCancelReason ||
                  (rejectCancelReason === "OTHER_REASON" && (!otherReason.trim() || otherReason.trim().length < 2)) ||
                  isRejectCancelPending
                }
                isLoading={isRejectCancelPending}
              >
                {isRejectCancelPending ? "提交中..." : "确认拒绝"}
              </Button>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </>
  )
}

const FulfillmentBadge = ({ order }: { order: HttpTypes.AdminOrder }) => {
  const { t } = useTranslation()

  const { label, color } = getOrderFulfillmentStatus(
    t,
    order.fulfillment_status
  )

  return (
    <StatusBadge color={color} className="text-nowrap">
      {label}
    </StatusBadge>
  )
}

const PaymentBadge = ({ order }: { order: HttpTypes.AdminOrder }) => {
  const { t } = useTranslation()

  const { label, color } = getOrderPaymentStatus(t, order.payment_status)

  return (
    <StatusBadge color={color} className="text-nowrap">
      {label}
    </StatusBadge>
  )
}

const OrderBadge = ({ order }: { order: HttpTypes.AdminOrder }) => {
  const { t } = useTranslation()
  const orderStatus = getCanceledOrderStatus(t, order.status)

  if (!orderStatus) {
    return null
  }

  return (
    <StatusBadge color={orderStatus.color} className="text-nowrap">
      {orderStatus.label}
    </StatusBadge>
  )
}
