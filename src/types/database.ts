
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "addresses": {
                  Row: {
                    "address_line": string,"county": string,"created_at": string,"full_name": string,"id": string,"instructions": string | null,"is_default": boolean,"label": string | null,"phone": string,"town": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "address_line": string,"county": string,"created_at"?: string,"full_name": string,"id"?: string,"instructions"?: string | null,"is_default"?: boolean,"label"?: string | null,"phone": string,"town": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "address_line"?: string,"county"?: string,"created_at"?: string,"full_name"?: string,"id"?: string,"instructions"?: string | null,"is_default"?: boolean,"label"?: string | null,"phone"?: string,"town"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_email": string | null,"actor_id": string | null,"after": Json | null,"before": Json | null,"created_at": string,"id": string,"ip": string | null,"resource": string,"resource_id": string | null
                  }
                  Insert: {
                    "action": string,"actor_email"?: string | null,"actor_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"id"?: string,"ip"?: string | null,"resource": string,"resource_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_email"?: string | null,"actor_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"id"?: string,"ip"?: string | null,"resource"?: string,"resource_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"brands": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"is_active": boolean,"logo_url": string | null,"name": string,"seo_description": string | null,"seo_title": string | null,"slug": string,"sort_order": number,"updated_at": string,"website": string | null
                  }
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"logo_url"?: string | null,"name": string,"seo_description"?: string | null,"seo_title"?: string | null,"slug": string,"sort_order"?: number,"updated_at"?: string,"website"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"logo_url"?: string | null,"name"?: string,"seo_description"?: string | null,"seo_title"?: string | null,"slug"?: string,"sort_order"?: number,"updated_at"?: string,"website"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"cart_items": {
                  Row: {
                    "cart_id": string,"created_at": string,"id": string,"product_id": string,"quantity": number,"variant_id": string | null
                  }
                  Insert: {
                    "cart_id": string,"created_at"?: string,"id"?: string,"product_id": string,"quantity": number,"variant_id"?: string | null
                  }
                  Update: {
                    "cart_id"?: string,"created_at"?: string,"id"?: string,"product_id"?: string,"quantity"?: number,"variant_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "cart_items_cart_id_fkey"
      columns: ["cart_id"]
isOneToOne: false
      referencedRelation: "carts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cart_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cart_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cart_items_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"carts": {
                  Row: {
                    "created_at": string,"id": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"image_url": string | null,"is_active": boolean,"name": string,"parent_id": string | null,"seo_description": string | null,"seo_title": string | null,"slug": string,"sort_order": number,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"image_url"?: string | null,"is_active"?: boolean,"name": string,"parent_id"?: string | null,"seo_description"?: string | null,"seo_title"?: string | null,"slug": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"image_url"?: string | null,"is_active"?: boolean,"name"?: string,"parent_id"?: string | null,"seo_description"?: string | null,"seo_title"?: string | null,"slug"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"coupon_usage": {
                  Row: {
                    "coupon_id": string,"created_at": string,"customer_email": string | null,"customer_phone": string | null,"discount_amount": number,"id": string,"order_id": string,"user_id": string | null
                  }
                  Insert: {
                    "coupon_id": string,"created_at"?: string,"customer_email"?: string | null,"customer_phone"?: string | null,"discount_amount": number,"id"?: string,"order_id": string,"user_id"?: string | null
                  }
                  Update: {
                    "coupon_id"?: string,"created_at"?: string,"customer_email"?: string | null,"customer_phone"?: string | null,"discount_amount"?: number,"id"?: string,"order_id"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "coupon_usage_coupon_id_fkey"
      columns: ["coupon_id"]
isOneToOne: false
      referencedRelation: "coupons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coupon_usage_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"coupons": {
                  Row: {
                    "applicable_category_ids": (string)[],"applicable_product_ids": (string)[],"code": string,"created_at": string,"description": string | null,"discount_type": Database["public"]['Enums']["discount_type"],"expires_at": string | null,"id": string,"is_active": boolean,"maximum_discount": number | null,"minimum_order": number,"per_customer_limit": number | null,"starts_at": string | null,"updated_at": string,"usage_count": number,"usage_limit": number | null,"value": number
                  }
                  Insert: {
                    "applicable_category_ids"?: (string)[],"applicable_product_ids"?: (string)[],"code": string,"created_at"?: string,"description"?: string | null,"discount_type": Database["public"]['Enums']["discount_type"],"expires_at"?: string | null,"id"?: string,"is_active"?: boolean,"maximum_discount"?: number | null,"minimum_order"?: number,"per_customer_limit"?: number | null,"starts_at"?: string | null,"updated_at"?: string,"usage_count"?: number,"usage_limit"?: number | null,"value": number
                  }
                  Update: {
                    "applicable_category_ids"?: (string)[],"applicable_product_ids"?: (string)[],"code"?: string,"created_at"?: string,"description"?: string | null,"discount_type"?: Database["public"]['Enums']["discount_type"],"expires_at"?: string | null,"id"?: string,"is_active"?: boolean,"maximum_discount"?: number | null,"minimum_order"?: number,"per_customer_limit"?: number | null,"starts_at"?: string | null,"updated_at"?: string,"usage_count"?: number,"usage_limit"?: number | null,"value"?: number
                  }
                  Relationships: [
                    
                  ]
                },"delivery_zones": {
                  Row: {
                    "counties": (string)[],"created_at": string,"estimate_label": string | null,"estimated_days_max": number,"estimated_days_min": number,"fee": number,"free_delivery_threshold": number | null,"id": string,"is_active": boolean,"is_default": boolean,"name": string,"sort_order": number,"updated_at": string
                  }
                  Insert: {
                    "counties"?: (string)[],"created_at"?: string,"estimate_label"?: string | null,"estimated_days_max"?: number,"estimated_days_min"?: number,"fee": number,"free_delivery_threshold"?: number | null,"id"?: string,"is_active"?: boolean,"is_default"?: boolean,"name": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "counties"?: (string)[],"created_at"?: string,"estimate_label"?: string | null,"estimated_days_max"?: number,"estimated_days_min"?: number,"fee"?: number,"free_delivery_threshold"?: number | null,"id"?: string,"is_active"?: boolean,"is_default"?: boolean,"name"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"homepage_banners": {
                  Row: {
                    "background": string | null,"created_at": string,"cta_text": string | null,"cta_url": string | null,"ends_at": string | null,"eyebrow": string | null,"featured_product_id": string | null,"highlight": string | null,"id": string,"image_alt": string | null,"image_url": string | null,"is_active": boolean,"secondary_cta_text": string | null,"secondary_cta_url": string | null,"sort_order": number,"starts_at": string | null,"subtitle": string | null,"title": string,"updated_at": string
                  }
                  Insert: {
                    "background"?: string | null,"created_at"?: string,"cta_text"?: string | null,"cta_url"?: string | null,"ends_at"?: string | null,"eyebrow"?: string | null,"featured_product_id"?: string | null,"highlight"?: string | null,"id"?: string,"image_alt"?: string | null,"image_url"?: string | null,"is_active"?: boolean,"secondary_cta_text"?: string | null,"secondary_cta_url"?: string | null,"sort_order"?: number,"starts_at"?: string | null,"subtitle"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "background"?: string | null,"created_at"?: string,"cta_text"?: string | null,"cta_url"?: string | null,"ends_at"?: string | null,"eyebrow"?: string | null,"featured_product_id"?: string | null,"highlight"?: string | null,"id"?: string,"image_alt"?: string | null,"image_url"?: string | null,"is_active"?: boolean,"secondary_cta_text"?: string | null,"secondary_cta_url"?: string | null,"sort_order"?: number,"starts_at"?: string | null,"subtitle"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "homepage_banners_featured_product_id_fkey"
      columns: ["featured_product_id"]
isOneToOne: false
      referencedRelation: "product_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "homepage_banners_featured_product_id_fkey"
      columns: ["featured_product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"homepage_sections": {
                  Row: {
                    "config": NonNullable<Json>,"id": string,"is_enabled": boolean,"key": string,"sort_order": number,"subtitle": string | null,"title": string | null,"updated_at": string
                  }
                  Insert: {
                    "config"?: NonNullable<Json>,"id"?: string,"is_enabled"?: boolean,"key": string,"sort_order"?: number,"subtitle"?: string | null,"title"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "config"?: NonNullable<Json>,"id"?: string,"is_enabled"?: boolean,"key"?: string,"sort_order"?: number,"subtitle"?: string | null,"title"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"inventory_transactions": {
                  Row: {
                    "change": number,"created_at": string,"id": string,"new_quantity": number,"note": string | null,"previous_quantity": number,"product_id": string,"reason": Database["public"]['Enums']["inventory_reason"],"reference": string | null,"user_id": string | null,"variant_id": string | null
                  }
                  Insert: {
                    "change": number,"created_at"?: string,"id"?: string,"new_quantity": number,"note"?: string | null,"previous_quantity": number,"product_id": string,"reason": Database["public"]['Enums']["inventory_reason"],"reference"?: string | null,"user_id"?: string | null,"variant_id"?: string | null
                  }
                  Update: {
                    "change"?: number,"created_at"?: string,"id"?: string,"new_quantity"?: number,"note"?: string | null,"previous_quantity"?: number,"product_id"?: string,"reason"?: Database["public"]['Enums']["inventory_reason"],"reference"?: string | null,"user_id"?: string | null,"variant_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_transactions_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_transactions_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_transactions_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"channel": string,"created_at": string,"error": string | null,"id": string,"kind": string,"order_id": string | null,"payload": NonNullable<Json>,"read_at": string | null,"recipient": string | null,"sent_at": string | null,"status": string,"subject": string | null
                  }
                  Insert: {
                    "body"?: string | null,"channel": string,"created_at"?: string,"error"?: string | null,"id"?: string,"kind": string,"order_id"?: string | null,"payload"?: NonNullable<Json>,"read_at"?: string | null,"recipient"?: string | null,"sent_at"?: string | null,"status"?: string,"subject"?: string | null
                  }
                  Update: {
                    "body"?: string | null,"channel"?: string,"created_at"?: string,"error"?: string | null,"id"?: string,"kind"?: string,"order_id"?: string | null,"payload"?: NonNullable<Json>,"read_at"?: string | null,"recipient"?: string | null,"sent_at"?: string | null,"status"?: string,"subject"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "id": string,"image_url": string | null,"order_id": string,"product_id": string | null,"product_name": string,"quantity": number,"sku": string,"total_price": number,"unit_price": number,"variant_id": string | null,"variant_name": string | null
                  }
                  Insert: {
                    "id"?: string,"image_url"?: string | null,"order_id": string,"product_id"?: string | null,"product_name": string,"quantity": number,"sku": string,"total_price": number,"unit_price": number,"variant_id"?: string | null,"variant_name"?: string | null
                  }
                  Update: {
                    "id"?: string,"image_url"?: string | null,"order_id"?: string,"product_id"?: string | null,"product_name"?: string,"quantity"?: number,"sku"?: string,"total_price"?: number,"unit_price"?: number,"variant_id"?: string | null,"variant_name"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"order_number_counters": {
                  Row: {
                    "day": string,"last_value": number
                  }
                  Insert: {
                    "day": string,"last_value"?: number
                  }
                  Update: {
                    "day"?: string,"last_value"?: number
                  }
                  Relationships: [
                    
                  ]
                },"order_status_history": {
                  Row: {
                    "changed_by": string | null,"created_at": string,"id": string,"note": string | null,"order_id": string,"status": Database["public"]['Enums']["order_status"]
                  }
                  Insert: {
                    "changed_by"?: string | null,"created_at"?: string,"id"?: string,"note"?: string | null,"order_id": string,"status": Database["public"]['Enums']["order_status"]
                  }
                  Update: {
                    "changed_by"?: string | null,"created_at"?: string,"id"?: string,"note"?: string | null,"order_id"?: string,"status"?: Database["public"]['Enums']["order_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_status_history_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "access_token": string,"admin_notes": string | null,"coupon_code": string | null,"coupon_id": string | null,"created_at": string,"currency": string,"customer_email": string,"customer_name": string,"customer_notes": string | null,"customer_phone": string,"delivery_address": string,"delivery_county": string,"delivery_fee": number,"delivery_instructions": string | null,"delivery_town": string,"delivery_zone_id": string | null,"delivery_zone_name": string | null,"discount": number,"id": string,"order_number": string,"order_status": Database["public"]['Enums']["order_status"],"paid_at": string | null,"payment_method": Database["public"]['Enums']["payment_method"],"payment_status": Database["public"]['Enums']["payment_status"],"reservation_expires_at": string | null,"stock_state": Database["public"]['Enums']["stock_state"],"subtotal": number,"total": number,"updated_at": string,"user_id": string | null
                  }
                  Insert: {
                    "access_token"?: string,"admin_notes"?: string | null,"coupon_code"?: string | null,"coupon_id"?: string | null,"created_at"?: string,"currency"?: string,"customer_email": string,"customer_name": string,"customer_notes"?: string | null,"customer_phone": string,"delivery_address": string,"delivery_county": string,"delivery_fee"?: number,"delivery_instructions"?: string | null,"delivery_town": string,"delivery_zone_id"?: string | null,"delivery_zone_name"?: string | null,"discount"?: number,"id"?: string,"order_number": string,"order_status"?: Database["public"]['Enums']["order_status"],"paid_at"?: string | null,"payment_method": Database["public"]['Enums']["payment_method"],"payment_status"?: Database["public"]['Enums']["payment_status"],"reservation_expires_at"?: string | null,"stock_state"?: Database["public"]['Enums']["stock_state"],"subtotal": number,"total": number,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "access_token"?: string,"admin_notes"?: string | null,"coupon_code"?: string | null,"coupon_id"?: string | null,"created_at"?: string,"currency"?: string,"customer_email"?: string,"customer_name"?: string,"customer_notes"?: string | null,"customer_phone"?: string,"delivery_address"?: string,"delivery_county"?: string,"delivery_fee"?: number,"delivery_instructions"?: string | null,"delivery_town"?: string,"delivery_zone_id"?: string | null,"delivery_zone_name"?: string | null,"discount"?: number,"id"?: string,"order_number"?: string,"order_status"?: Database["public"]['Enums']["order_status"],"paid_at"?: string | null,"payment_method"?: Database["public"]['Enums']["payment_method"],"payment_status"?: Database["public"]['Enums']["payment_status"],"reservation_expires_at"?: string | null,"stock_state"?: Database["public"]['Enums']["stock_state"],"subtotal"?: number,"total"?: number,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_coupon_id_fkey"
      columns: ["coupon_id"]
isOneToOne: false
      referencedRelation: "coupons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_delivery_zone_id_fkey"
      columns: ["delivery_zone_id"]
isOneToOne: false
      referencedRelation: "delivery_zones"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"checkout_request_id": string | null,"created_at": string,"id": string,"merchant_request_id": string | null,"method": Database["public"]['Enums']["payment_method"],"order_id": string,"paid_at": string | null,"phone_number": string | null,"provider": string,"raw_response": Json | null,"result_code": string | null,"result_description": string | null,"status": Database["public"]['Enums']["payment_status"],"transaction_reference": string | null,"updated_at": string
                  }
                  Insert: {
                    "amount": number,"checkout_request_id"?: string | null,"created_at"?: string,"id"?: string,"merchant_request_id"?: string | null,"method": Database["public"]['Enums']["payment_method"],"order_id": string,"paid_at"?: string | null,"phone_number"?: string | null,"provider": string,"raw_response"?: Json | null,"result_code"?: string | null,"result_description"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"transaction_reference"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"checkout_request_id"?: string | null,"created_at"?: string,"id"?: string,"merchant_request_id"?: string | null,"method"?: Database["public"]['Enums']["payment_method"],"order_id"?: string,"paid_at"?: string | null,"phone_number"?: string | null,"provider"?: string,"raw_response"?: Json | null,"result_code"?: string | null,"result_description"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"transaction_reference"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"printer_models": {
                  Row: {
                    "brand_id": string,"created_at": string,"description": string | null,"id": string,"model_number": string,"name": string,"slug": string,"updated_at": string
                  }
                  Insert: {
                    "brand_id": string,"created_at"?: string,"description"?: string | null,"id"?: string,"model_number": string,"name": string,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "brand_id"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"model_number"?: string,"name"?: string,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "printer_models_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    }
                  ]
                },"product_compatibility": {
                  Row: {
                    "compatibility_notes": string | null,"created_at": string,"id": string,"printer_model_id": string,"product_id": string
                  }
                  Insert: {
                    "compatibility_notes"?: string | null,"created_at"?: string,"id"?: string,"printer_model_id": string,"product_id": string
                  }
                  Update: {
                    "compatibility_notes"?: string | null,"created_at"?: string,"id"?: string,"printer_model_id"?: string,"product_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_compatibility_printer_model_id_fkey"
      columns: ["printer_model_id"]
isOneToOne: false
      referencedRelation: "printer_models"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_compatibility_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_compatibility_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"product_costs": {
                  Row: {
                    "cost_price": number | null,"product_id": string,"updated_at": string
                  }
                  Insert: {
                    "cost_price"?: number | null,"product_id": string,"updated_at"?: string
                  }
                  Update: {
                    "cost_price"?: number | null,"product_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_costs_product_id_fkey"
      columns: ["product_id"]
isOneToOne: true
      referencedRelation: "product_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_costs_product_id_fkey"
      columns: ["product_id"]
isOneToOne: true
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"product_images": {
                  Row: {
                    "alt_text": string | null,"created_at": string,"height": number | null,"id": string,"is_primary": boolean,"product_id": string,"sort_order": number,"storage_path": string | null,"url": string,"variant_id": string | null,"width": number | null
                  }
                  Insert: {
                    "alt_text"?: string | null,"created_at"?: string,"height"?: number | null,"id"?: string,"is_primary"?: boolean,"product_id": string,"sort_order"?: number,"storage_path"?: string | null,"url": string,"variant_id"?: string | null,"width"?: number | null
                  }
                  Update: {
                    "alt_text"?: string | null,"created_at"?: string,"height"?: number | null,"id"?: string,"is_primary"?: boolean,"product_id"?: string,"sort_order"?: number,"storage_path"?: string | null,"url"?: string,"variant_id"?: string | null,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_images_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_images_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_images_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"product_variants": {
                  Row: {
                    "available_quantity": number | null,"compare_at_price": number | null,"created_at": string,"id": string,"image_url": string | null,"is_active": boolean,"low_stock_threshold": number,"name": string,"option_values": NonNullable<Json>,"price": number,"product_id": string,"reserved_quantity": number,"sku": string,"sort_order": number,"stock_quantity": number,"updated_at": string,"weight_kg": number | null
                  }
                  Insert: {
                    "available_quantity"?: never,"compare_at_price"?: number | null,"created_at"?: string,"id"?: string,"image_url"?: string | null,"is_active"?: boolean,"low_stock_threshold"?: number,"name": string,"option_values"?: NonNullable<Json>,"price": number,"product_id": string,"reserved_quantity"?: number,"sku": string,"sort_order"?: number,"stock_quantity"?: number,"updated_at"?: string,"weight_kg"?: number | null
                  }
                  Update: {
                    "available_quantity"?: never,"compare_at_price"?: number | null,"created_at"?: string,"id"?: string,"image_url"?: string | null,"is_active"?: boolean,"low_stock_threshold"?: number,"name"?: string,"option_values"?: NonNullable<Json>,"price"?: number,"product_id"?: string,"reserved_quantity"?: number,"sku"?: string,"sort_order"?: number,"stock_quantity"?: number,"updated_at"?: string,"weight_kg"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_variants_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_variants_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "available_quantity": number | null,"barcode": string | null,"brand_id": string | null,"canonical_url": string | null,"category_id": string | null,"compare_at_price": number | null,"condition": string | null,"created_at": string,"description": string | null,"dimensions": string | null,"discount_percent": number | null,"features": (string)[],"id": string,"is_bestseller": boolean,"is_featured": boolean,"is_new": boolean,"is_on_sale": boolean,"low_stock_threshold": number,"name": string,"oem_number": string | null,"og_description": string | null,"og_image_url": string | null,"og_title": string | null,"part_number": string | null,"price": number,"printer_model_id": string | null,"product_type": Database["public"]['Enums']["product_type"],"rating_avg": number,"rating_count": number,"reserved_quantity": number,"sales_count": number,"search_text": string,"search_vector": unknown,"seo_description": string | null,"seo_title": string | null,"short_description": string | null,"sku": string,"slug": string,"specifications": NonNullable<Json>,"status": Database["public"]['Enums']["product_status"],"stock_quantity": number,"updated_at": string,"warranty": string | null,"weight_kg": number | null,"whats_included": (string)[],"build_product_search_text": string | null
                  }
                  Insert: {
                    "available_quantity"?: never,"barcode"?: string | null,"brand_id"?: string | null,"canonical_url"?: string | null,"category_id"?: string | null,"compare_at_price"?: number | null,"condition"?: string | null,"created_at"?: string,"description"?: string | null,"dimensions"?: string | null,"discount_percent"?: never,"features"?: (string)[],"id"?: string,"is_bestseller"?: boolean,"is_featured"?: boolean,"is_new"?: boolean,"is_on_sale"?: boolean,"low_stock_threshold"?: number,"name": string,"oem_number"?: string | null,"og_description"?: string | null,"og_image_url"?: string | null,"og_title"?: string | null,"part_number"?: string | null,"price": number,"printer_model_id"?: string | null,"product_type"?: Database["public"]['Enums']["product_type"],"rating_avg"?: number,"rating_count"?: number,"reserved_quantity"?: number,"sales_count"?: number,"search_text"?: string,"search_vector"?: never,"seo_description"?: string | null,"seo_title"?: string | null,"short_description"?: string | null,"sku": string,"slug": string,"specifications"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["product_status"],"stock_quantity"?: number,"updated_at"?: string,"warranty"?: string | null,"weight_kg"?: number | null,"whats_included"?: (string)[]
                  }
                  Update: {
                    "available_quantity"?: never,"barcode"?: string | null,"brand_id"?: string | null,"canonical_url"?: string | null,"category_id"?: string | null,"compare_at_price"?: number | null,"condition"?: string | null,"created_at"?: string,"description"?: string | null,"dimensions"?: string | null,"discount_percent"?: never,"features"?: (string)[],"id"?: string,"is_bestseller"?: boolean,"is_featured"?: boolean,"is_new"?: boolean,"is_on_sale"?: boolean,"low_stock_threshold"?: number,"name"?: string,"oem_number"?: string | null,"og_description"?: string | null,"og_image_url"?: string | null,"og_title"?: string | null,"part_number"?: string | null,"price"?: number,"printer_model_id"?: string | null,"product_type"?: Database["public"]['Enums']["product_type"],"rating_avg"?: number,"rating_count"?: number,"reserved_quantity"?: number,"sales_count"?: number,"search_text"?: string,"search_vector"?: never,"seo_description"?: string | null,"seo_title"?: string | null,"short_description"?: string | null,"sku"?: string,"slug"?: string,"specifications"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["product_status"],"stock_quantity"?: number,"updated_at"?: string,"warranty"?: string | null,"weight_kg"?: number | null,"whats_included"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_printer_model_id_fkey"
      columns: ["printer_model_id"]
isOneToOne: false
      referencedRelation: "printer_models"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string | null,"id": string,"phone": string | null,"role": Database["public"]['Enums']["user_role"],"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id": string,"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id"?: string,"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"rate_limits": {
                  Row: {
                    "hits": number,"key": string,"window_start": string
                  }
                  Insert: {
                    "hits": number,"key": string,"window_start": string
                  }
                  Update: {
                    "hits"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reviews": {
                  Row: {
                    "admin_note": string | null,"author_name": string | null,"comment": string | null,"created_at": string,"id": string,"is_verified_purchase": boolean,"photos": (string)[],"product_id": string,"rating": number,"status": Database["public"]['Enums']["review_status"],"title": string | null,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "admin_note"?: string | null,"author_name"?: string | null,"comment"?: string | null,"created_at"?: string,"id"?: string,"is_verified_purchase"?: boolean,"photos"?: (string)[],"product_id": string,"rating": number,"status"?: Database["public"]['Enums']["review_status"],"title"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "admin_note"?: string | null,"author_name"?: string | null,"comment"?: string | null,"created_at"?: string,"id"?: string,"is_verified_purchase"?: boolean,"photos"?: (string)[],"product_id"?: string,"rating"?: number,"status"?: Database["public"]['Enums']["review_status"],"title"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"role_permissions": {
                  Row: {
                    "permission": string,"role": Database["public"]['Enums']["user_role"]
                  }
                  Insert: {
                    "permission": string,"role": Database["public"]['Enums']["user_role"]
                  }
                  Update: {
                    "permission"?: string,"role"?: Database["public"]['Enums']["user_role"]
                  }
                  Relationships: [
                    
                  ]
                },"settings": {
                  Row: {
                    "is_public": boolean,"key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  Insert: {
                    "is_public"?: boolean,"key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "is_public"?: boolean,"key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"support_requests": {
                  Row: {
                    "admin_response": string | null,"attachment_path": string | null,"created_at": string,"email": string | null,"id": string,"kind": string,"message": string,"name": string,"phone": string | null,"printer_brand": string | null,"printer_model": string | null,"responded_at": string | null,"responded_by": string | null,"status": Database["public"]['Enums']["support_status"],"subject": string | null,"updated_at": string,"user_id": string | null
                  }
                  Insert: {
                    "admin_response"?: string | null,"attachment_path"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"kind": string,"message": string,"name": string,"phone"?: string | null,"printer_brand"?: string | null,"printer_model"?: string | null,"responded_at"?: string | null,"responded_by"?: string | null,"status"?: Database["public"]['Enums']["support_status"],"subject"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "admin_response"?: string | null,"attachment_path"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"kind"?: string,"message"?: string,"name"?: string,"phone"?: string | null,"printer_brand"?: string | null,"printer_model"?: string | null,"responded_at"?: string | null,"responded_by"?: string | null,"status"?: Database["public"]['Enums']["support_status"],"subject"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"wishlist_items": {
                  Row: {
                    "created_at": string,"id": string,"product_id": string,"wishlist_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"product_id": string,"wishlist_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"product_id"?: string,"wishlist_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wishlist_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wishlist_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wishlist_items_wishlist_id_fkey"
      columns: ["wishlist_id"]
isOneToOne: false
      referencedRelation: "wishlists"
      referencedColumns: ["id"]
    }
                  ]
                },"wishlists": {
                  Row: {
                    "created_at": string,"id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "category_product_counts": {
                  Row: {
                    "category_id": string | null,"product_count": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"compatibility_counts": {
                  Row: {
                    "printer_model_id": string | null,"product_count": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_compatibility_printer_model_id_fkey"
      columns: ["printer_model_id"]
isOneToOne: false
      referencedRelation: "printer_models"
      referencedColumns: ["id"]
    }
                  ]
                },"customers": {
                  Row: {
                    "created_at": string | null,"email": string | null,"full_name": string | null,"id": string | null,"last_order_at": string | null,"orders_count": number | null,"phone": string | null,"total_spent": number | null
                  }
                  Relationships: [
                    
                  ]
                },"inventory": {
                  Row: {
                    "available_quantity": number | null,"is_low_stock": boolean | null,"low_stock_threshold": number | null,"name": string | null,"product_id": string | null,"reserved_quantity": number | null,"sku": string | null,"status": Database["public"]['Enums']["product_status"] | null,"stock_quantity": number | null,"variant_id": string | null
                  }
                  Relationships: [
                    
                  ]
                },"inventory_totals": {
                  Row: {
                    "reserved": number | null,"skus": number | null,"stock": number | null
                  }
                  Relationships: [
                    
                  ]
                },"product_cards": {
                  Row: {
                    "available_quantity": number | null,"brand_id": string | null,"brand_name": string | null,"brand_slug": string | null,"category_id": string | null,"category_name": string | null,"category_slug": string | null,"compare_at_price": number | null,"created_at": string | null,"discount_percent": number | null,"has_variants": boolean | null,"id": string | null,"image_alt": string | null,"image_url": string | null,"is_bestseller": boolean | null,"is_featured": boolean | null,"is_new": boolean | null,"is_on_sale": boolean | null,"low_stock_threshold": number | null,"name": string | null,"part_number": string | null,"price": number | null,"product_type": Database["public"]['Enums']["product_type"] | null,"rating_avg": number | null,"rating_count": number | null,"sales_count": number | null,"short_description": string | null,"sku": string | null,"slug": string | null,"status": Database["public"]['Enums']["product_status"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"product_counts_by_brand": {
                  Row: {
                    "brand_id": string | null,"product_count": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    }
                  ]
                },"product_counts_by_category": {
                  Row: {
                    "category_id": string | null,"product_count": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "adjust_stock":
{ Args: { "p_change": number,"p_note"?: string,"p_product_id": string,"p_reason": Database["public"]['Enums']["inventory_reason"],"p_reference"?: string,"p_variant_id": string }; Returns: number
                           },
"admin_dashboard_stats":
{ Args: { "p_days"?: number }; Returns: Json
                           },
"build_product_search_text":
{ Args: { "p": Database["public"]['Tables']["products"]['Row'] }; Returns: string
                           },
"catalog_search":
{ Args: { "p_brand_slugs"?: (string)[],"p_category_slug"?: string,"p_in_stock"?: boolean,"p_limit"?: number,"p_max_price"?: number,"p_min_price"?: number,"p_min_rating"?: number,"p_offset"?: number,"p_on_sale"?: boolean,"p_printer_model_id"?: string,"p_product_types"?: (Database["public"]['Enums']["product_type"])[],"p_query"?: string,"p_sort"?: string }; Returns: Json
                           },
"category_descendant_ids":
{ Args: { "p_category_id": string }; Returns: (string)[]
                           },
"check_rate_limit":
{ Args: { "p_key": string,"p_max": number,"p_window_seconds": number }; Returns: boolean
                           },
"confirm_payment":
{ Args: { "p_actor"?: string,"p_amount": number,"p_payment_id": string,"p_raw"?: Json,"p_transaction_reference": string }; Returns: Json
                           },
"current_role_name":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["user_role"]
                           },
"deduct_order_stock":
{ Args: { "p_actor"?: string,"p_order_id": string }; Returns: Database["public"]['Enums']["stock_state"]
                           },
"expire_stale_orders":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"fail_payment":
{ Args: { "p_description": string,"p_payment_id": string,"p_raw"?: Json,"p_result_code": string }; Returns: Json
                           },
"generate_order_number":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"has_permission":
{ Args: { "p_permission": string }; Returns: boolean
                           },
"is_service_role":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"notify_admin":
{ Args: { "p_kind": string,"p_order_id"?: string,"p_payload": Json,"p_subject": string }; Returns: undefined
                           },
"place_order":
{ Args: { "p_order": Json }; Returns: Json
                           },
"refresh_product_search":
{ Args: { "p_product_id": string }; Returns: undefined
                           },
"release_order_reservation":
{ Args: { "p_order_id": string }; Returns: boolean
                           },
"restock_order":
{ Args: { "p_actor"?: string,"p_order_id": string }; Returns: undefined
                           },
"to_prefix_tsquery":
{ Args: { "p_query": string }; Returns: unknown
                           },
"update_order_status":
{ Args: { "p_note"?: string,"p_order_id": string,"p_status": Database["public"]['Enums']["order_status"] }; Returns: Json
                           }
          }
          Enums: {
            "discount_type": "percentage"|"fixed","inventory_reason": "purchase"|"sale"|"manual_adjustment"|"return"|"damage"|"correction"|"order_cancellation","order_status": "PENDING"|"PAYMENT_PENDING"|"PAID"|"PROCESSING"|"READY_FOR_DISPATCH"|"SHIPPED"|"DELIVERED"|"CANCELLED"|"REFUNDED"|"FAILED","payment_method": "mpesa"|"card"|"bank_transfer"|"cash_on_delivery","payment_status": "PENDING"|"PROCESSING"|"PAID"|"FAILED"|"CANCELLED"|"REFUNDED","product_status": "draft"|"active"|"archived","product_type": "simple"|"variable"|"printer"|"spare_part"|"accessory"|"ink_toner"|"scanner"|"paper","review_status": "pending"|"approved"|"rejected","stock_state": "reserved"|"deducted"|"released"|"restocked"|"shortage","support_status": "open"|"in_progress"|"resolved"|"closed","user_role": "customer"|"super_admin"|"admin"|"manager"|"inventory_manager"|"order_manager"|"content_manager"|"support_agent"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "discount_type": ["percentage", "fixed"],"inventory_reason": ["purchase", "sale", "manual_adjustment", "return", "damage", "correction", "order_cancellation"],"order_status": ["PENDING", "PAYMENT_PENDING", "PAID", "PROCESSING", "READY_FOR_DISPATCH", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED", "FAILED"],"payment_method": ["mpesa", "card", "bank_transfer", "cash_on_delivery"],"payment_status": ["PENDING", "PROCESSING", "PAID", "FAILED", "CANCELLED", "REFUNDED"],"product_status": ["draft", "active", "archived"],"product_type": ["simple", "variable", "printer", "spare_part", "accessory", "ink_toner", "scanner", "paper"],"review_status": ["pending", "approved", "rejected"],"stock_state": ["reserved", "deducted", "released", "restocked", "shortage"],"support_status": ["open", "in_progress", "resolved", "closed"],"user_role": ["customer", "super_admin", "admin", "manager", "inventory_manager", "order_manager", "content_manager", "support_agent"]
          }
        }
} as const
