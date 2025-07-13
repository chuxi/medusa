import { ArrowDownTray, ArrowUpTray, Loader, PencilSquare, Text, Trash, TruckFast } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { Container, Heading, StatusBadge, toast, Toaster, usePrompt } from "@medusajs/ui"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { ActionMenu } from "../../../../../components/common/action-menu"
import { SectionRow } from "../../../../../components/common/section"
import { useDeleteProduct } from "../../../../../hooks/api/products"
import { useExtension } from "../../../../../providers/extension-provider"
import { useMutation, useQuery } from "@tanstack/react-query"
import { sdk } from "../../../../../lib/client"
import { queryClient } from "../../../../../lib/query-client"
import { useEffect, useState } from "react"


const productStatusColor = (status: string) => {
  switch (status) {
    case "draft":
      return "grey"
    case "proposed":
      return "orange"
    case "published":
      return "green"
    case "rejected":
      return "red"
    default:
      return "grey"
  }
}

type ProductGeneralSectionProps = {
  product: HttpTypes.AdminProduct
}

export const ProductGeneralSection = ({
  product,
}: ProductGeneralSectionProps) => {
  const { t } = useTranslation()
  const prompt = usePrompt()
  const navigate = useNavigate()
  const { getDisplays } = useExtension()

  const displays = getDisplays("product", "general")

  const { mutateAsync } = useDeleteProduct(product.id)

  const [isTransforming, setTransforming] = useState(false)
  const [isTransformed, setTransformed] = useState(!!product.metadata?.["images_translated"])

  const productQuery = useQuery({
    queryFn: () => sdk.admin.product.retrieve(product.id, {
      fields: "metadata",
    }),
    queryKey: ["products", "detail", product.id],
    enabled: isTransforming,
    refetchInterval: (query) => !query.state.data?.product.metadata?.["images_translated"] ? 5000 : false,
    refetchIntervalInBackground: true,
  })

  useEffect(() => {
    if (isTransforming && !!productQuery.data?.product.metadata?.["images_translated"]) {
      setTransformed(true)
      setTransforming(false)
      toast.success("Success", {
        description: "格式转换成功"
      })
    }
  }, [productQuery.data])

  const { mutateAsync: transformAction } = useMutation({
    mutationFn: () => {
      return sdk.client.fetch(
        `/admin/ruten/product/${product.id}/transform`,
        { method: "POST", }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", "detail", product.id] })
      setTransforming(true)
      toast.success("Loading", {
        description: "格式转换任务已提交",
        duration: 3000,
      })
    },
    onError: (error) => {
      // setTransforming(false)
      toast.error("Error", {
        description: `格式转换失败: ${error}`,
      })
    }
  })

  // 发布商品到露天的 mutation
  const { mutateAsync: publishAction } = useMutation({
    mutationFn: () => sdk.client.fetch(
      `/admin/ruten/product/${product.id}/push`,
      { method: "POST" }
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", "detail", product.id] })
      toast.success("Success", {
        description: "商品已成功发布到露天",
        duration: 3000,
      })
    },
    onError: (error) => {
      toast.error("Error", {
        description: `商品发布失败: ${error}`,
        duration: 6000,
      })
    }
  })

  const { mutateAsync: putOnlineAction } = useMutation({
    mutationFn: () => {
      if (product.status === "proposed") {
        return sdk.client.fetch(
          `/admin/ruten/product/${product.id}/online`,
          { method: "POST", }
        )
      } else if (product.status === "published") {
        return sdk.client.fetch(
          `/admin/ruten/product/${product.id}/offline`,
          { method: "POST", }
        )
      }
      return Promise.resolve()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["products", "detail", product.id],
      })
    },
    onError: (error) => {
      if (product.status === "proposed") {
        toast.error("Error", {
          description: `商品上架失败: ${error}`,
          duration: 6000,
        })
      } else if (product.status === "published") {
        toast.error("Error", {
          description: `商品下架失败: ${error}`,
          duration: 6000,
        })
      }
    }
  })

  const handleDelete = async () => {
    const res = await prompt({
      title: t("general.areYouSure"),
      description: t("products.deleteWarning", {
        title: product.title,
      }),
      confirmText: t("actions.delete"),
      cancelText: t("actions.cancel"),
    })

    if (!res) {
      return
    }

    await mutateAsync(undefined, {
      onSuccess: () => {
        navigate("..")
      },
    })
  }

  const transformStatus = isTransforming ? ( <Loader /> ) : isTransformed ? (<Text color="green" />) : (<Text />)

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading>{product.title}</Heading>
        <div className="flex items-center gap-x-4">
          <StatusBadge color={productStatusColor(product.status)}>
            {t(`products.productStatus.${product.status}`)}
          </StatusBadge>
          <ActionMenu
            groups={[
              {
                actions: [
                  {
                    label: t("actions.edit"),
                    to: "edit",
                    icon: <PencilSquare />,
                  },
                ],
              },
              {
                actions: [
                  {
                    label: "格式转换",
                    onClick: transformAction,
                    icon: transformStatus,
                  },
                  {
                    label: t("actions.publish"),
                    onClick: publishAction,
                    icon: <TruckFast />,
                  },
                  {
                    label: "上架",
                    disabled: product.status !== "proposed",
                    onClick: putOnlineAction,
                    icon: <ArrowUpTray />,
                  },
                  {
                    label: "下架",
                    disabled: product.status !== "published",
                    onClick: putOnlineAction,
                    icon: <ArrowDownTray />,
                  },
                ]
              },
              {
                actions: [
                  {
                    label: t("actions.delete"),
                    onClick: handleDelete,
                    icon: <Trash />,
                  },
                ],
              },
            ]}
          />
        </div>
      </div>

      <SectionRow title={t("fields.description")} value={product.description} />
      <SectionRow title={t("fields.subtitle")} value={product.subtitle} />
      <SectionRow title={t("fields.handle")} value={`/${product.handle}`} />
      <SectionRow
        title={t("fields.discountable")}
        value={product.discountable ? t("fields.true") : t("fields.false")}
      />
      {displays.map((Component, index) => {
        return <Component key={index} data={product} />
      })}
    </Container>
  )
}
