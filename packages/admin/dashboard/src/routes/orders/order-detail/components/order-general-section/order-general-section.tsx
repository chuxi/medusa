import { XCircle } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import {
  Container,
  Copy,
  Heading,
  StatusBadge,
  Text,
  toast,
  usePrompt,
  Button,
  Select,
} from "@medusajs/ui"
import { useTranslation } from "react-i18next"
import { ActionMenu } from "../../../../../components/common/action-menu"
import { useCancelOrder } from "../../../../../hooks/api/orders"
import { useDate } from "../../../../../hooks/use-date"
import {
  getCanceledOrderStatus,
  getOrderFulfillmentStatus,
  getOrderPaymentStatus,
} from "../../../../../lib/order-helpers"
import { useState, useEffect } from "react"

type OrderGeneralSectionProps = {
  order: HttpTypes.AdminOrder
}

// 不同意的理由选项
const disagreeReasons = [
  { value: "ITEM_IN_PRODUCTION", label: "商品制作中" },
  { value: "ITEM_PURCHASED_OR_SHIPPING", label: "商品已代购完成或运送中" },
  { value: "ITEM_SHIPPED", label: "商品已出货" },
  { value: "ORDER_NOT_CANCELLED_BY_AGREEMENT", label: "双方协议不取消交易" },
  { value: "OTHER_REASON", label: "其他原因" },
]

// 取消订单的理由选项
const sellerCancelReasons = [
  { value: "ITEM_DEFECTIVE_OR_LOST", label: "有瑕疵或已遗失无法进行交易" },
  { value: "BUYER_UNREACHABLE", label: "无法联系上买家或买家不回应" },
  { value: "ORDER_CANCELLED_BY_AGREEMENT", label: "双方协调决定取消交易" },
  { value: "SELLER_OUT_OF_STOCK", label: "卖家缺货" },
  { value: "OTHER_REASON", label: "其他原因" },
]

export const OrderGeneralSection = ({ order }: OrderGeneralSectionProps) => {
  const { t } = useTranslation()
  const prompt = usePrompt()
  const { getFullDate } = useDate()
  const [disagreeReason, setDisagreeReason] = useState<string>("")
  const [showDisagreeSelect, setShowDisagreeSelect] = useState(false)
  const [cancelReason, setCancelReason] = useState<string>("")
  const [showCancelSelect, setShowCancelSelect] = useState(false)
  const [showBuyerCancelRequireAction, setShowBuyerCancelRequireAction] = useState(false)
  const { mutateAsync: cancelOrder } = useCancelOrder(order.id)

  // 检查订单状态
  useEffect(() => {
    const checkOrderStatus = async () => {
      try {
        const response = await fetch(`/admin/ruten/order/${order.id}/ruten_order_status`, {
          method: "GET",
          credentials: 'include',
        })
        
        if (response.ok) {
          const contentType = response.headers.get("content-type")
          if (contentType && contentType.includes("application/json")) {
            const data = await response.json()
            if (data.success === true) {
              if (order.status === "requires_action" && data.data.ruten_order_status === "InCancel") {
                setShowBuyerCancelRequireAction(true)
              } else {
                setShowBuyerCancelRequireAction(false)
              }
            }
          } else {
            console.warn("API返回的不是JSON格式:", response.status, response.statusText)
            setShowBuyerCancelRequireAction(false)
          }
        } else {
          console.warn("API请求失败:", response.status, response.statusText)
          setShowBuyerCancelRequireAction(false)
        }
      } catch (error) {
        console.error("检查订单状态失败:", error)
      }
    }

    checkOrderStatus()
  }, [order.id, order.status])

  const handleCancel = async () => {
    const res = await prompt({
      title: t("general.areYouSure"),
      description: t("orders.cancelWarning", {
        id: `#${order.display_id}`,
      }),
      confirmText: t("actions.continue"),
      cancelText: t("actions.cancel"),
    })

    if (!res) {
      return
    }

    // 用户确认取消，显示选择取消理由的界面
    setShowCancelSelect(true)
  }

  const handleCancelConfirm = async () => {
    if (!cancelReason) {
      toast.error("请选择取消订单的理由")
      return
    }

    try {
      const response = await fetch(`/admin/ruten/order/${order.id}/seller_cancel_order`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({cancel_reason: cancelReason}),
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success === true) {
          toast.success("订单取消申请已提交")
          setShowCancelSelect(false)
          setCancelReason("")
        } else {
          toast.error(`取消订单申请失败: ${data.failed_reason}`)
        }
      } else {
        toast.error(`取消订单申请失败: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      toast.error("网络错误，请重试")
    }
    setShowCancelSelect(false)
  }

  const handleCancelReasonChange = (value: string) => {
    setCancelReason(value)
  }

  const handleAgree = async () => {
    setShowDisagreeSelect(false)
    try {
      const response = await fetch(`/admin/ruten/order/${order.id}/buyer_cancel_order_seller_response`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({agree: true}),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success === true) {
          toast.success("同意取消订单成功")
          setShowDisagreeSelect(false)
          setDisagreeReason("")
        } else {
          if (data.failed_reason) {
            toast.error("同意取消订单失败: " + data.failed_reason)
          } else {
            toast.error("同意取消订单失败")
          }
        }
      } else {
        toast.error(`同意取消订单失败: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      toast.error("网络错误，请重试")
    }
  }

  const handleDisagree = async () => {
    if (!showDisagreeSelect) {
      // 第一次点击，显示下拉框
      setShowDisagreeSelect(true)
    } else if (disagreeReason) {
      try {
        const response = await fetch(`/admin/ruten/order/${order.id}/buyer_cancel_order_seller_response`, {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            agree: false,
            cancel_order_reject: {
              reject_reason_type: disagreeReason,
            }
          }),
        })
  
        if (response.ok) {
          const data = await response.json()
          if (data.success === true) {
            toast.success("拒绝取消订单成功")
            setShowDisagreeSelect(false)
            setDisagreeReason("")
          } else {
            if (data.failed_reason) {
              toast.error("拒绝取消订单失败: " + data.failed_reason)
            } else {
              toast.error("拒绝取消订单失败")
            }
          }
        } else {
          toast.error(`拒绝取消订单失败: ${response.status} ${response.statusText}`)
        }
      } catch (error) {
        toast.error("网络错误，请重试")
      }
    } else {
      // 显示下拉框但未选择理由
      toast.error("请选择不同意的理由")
    }
  }

  const handleDisagreeReasonChange = (value: string) => {
    setDisagreeReason(value)
  }

  return (
    <>
      <Container className="flex items-center justify-between px-6 py-4">
      <div>
        <div className="flex items-center gap-x-1">
          <Heading>#{order.display_id}</Heading>
          <Copy content={`#${order.display_id}`} className="text-ui-fg-muted" />
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
              actions: [
                {
                  label: "申请取消订单",
                  onClick: handleCancel,
                  disabled: !!order.canceled_at,
                  icon: <XCircle />,
                },
              ],
            },
          ]}
        />
      </div>
    </Container>
      
      {/* 新增的Require Action行 */}
      {showBuyerCancelRequireAction && (
        <Container className="flex items-center justify-between px-6 py-4 border-t">
          <div>
            <Text className="font-medium">Require Action: 用户请求取消订单</Text>
          </div>
          <div className="flex items-center gap-x-2">
            {showDisagreeSelect ? (
              <div className="flex items-center gap-x-2 p-3 border border-ui-border-base rounded-md bg-ui-bg-subtle">
                <Select
                  value={disagreeReason}
                  onValueChange={handleDisagreeReasonChange}
                  size="small"
                >
                  <Select.Trigger className="w-40">
                    <Select.Value placeholder="选择理由" />
                  </Select.Trigger>
                  <Select.Content>
                    {disagreeReasons.map((reason) => (
                      <Select.Item key={reason.value} value={reason.value}>
                        {reason.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
                <Button
                  variant="danger"
                  size="small"
                  onClick={handleDisagree}
                >
                  确认拒绝
                </Button>
                <Button
                  variant="transparent"
                  size="small"
                  onClick={() => {
                    setShowDisagreeSelect(false)
                    setDisagreeReason("")
                  }}
                >
                  取消
                </Button>
              </div>
            ) : (
              <Button
                variant="danger"
                size="small"
                onClick={handleDisagree}
              >
                不同意
              </Button>
            )}
            <Button
              variant="primary"
              size="small"
              onClick={handleAgree}
            >
              同意
            </Button>
          </div>
        </Container>
      )}

      {/* 取消订单理由选择区域 */}
      {showCancelSelect && (
        <Container className="flex items-center justify-between px-6 py-4 border-t">
          <div>
            <Text className="font-medium">请选择取消订单的理由</Text>
          </div>
          <div className="flex items-center gap-x-2 p-3 border border-ui-border-base rounded-md bg-ui-bg-subtle">
            <Select
              value={cancelReason}
              onValueChange={handleCancelReasonChange}
              size="small"
            >
              <Select.Trigger className="w-40">
                <Select.Value placeholder="选择理由" />
              </Select.Trigger>
              <Select.Content>
                {sellerCancelReasons.map((reason) => (
                  <Select.Item key={reason.value} value={reason.value}>
                    {reason.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            <Button
              variant="danger"
              size="small"
              onClick={handleCancelConfirm}
            >
              确认取消
            </Button>
            <Button
              variant="transparent"
              size="small"
              onClick={() => {
                setShowCancelSelect(false)
                setCancelReason("")
              }}
            >
              取消
            </Button>
          </div>
        </Container>
      )}
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
