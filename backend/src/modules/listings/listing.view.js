import User from '../users/user.model.js'
import { categorySummary, getCategoryTree } from '../categories/category.tree.js'
import { publicUrl } from '../../services/storage.service.js'
import Listing, { PUBLIC_FILTER } from './listing.model.js'

/**
 * Shapes listings for the API. Seller details are loaded in two queries for the whole page,
 * and never include the seller's email or phone number.
 */
export const toListingViews = async (docs) => {
  const sellerIds = [...new Set(docs.map((d) => d.seller.toString()))]
  const [tree, sellers, activeCounts] = await Promise.all([
    getCategoryTree(),
    User.find({ _id: { $in: sellerIds } }).select('name city avatarKey createdAt').lean(),
    Listing.aggregate([
      { $match: { ...PUBLIC_FILTER, seller: { $in: docs.map((d) => d.seller) } } },
      { $group: { _id: '$seller', count: { $sum: 1 } } },
    ]),
  ])
  const sellerById = new Map(sellers.map((s) => [s._id.toString(), s]))
  const activeById = new Map(activeCounts.map((a) => [a._id.toString(), a.count]))

  return docs.map((d) => {
    const sellerId = d.seller.toString()
    const seller = sellerById.get(sellerId)
    return {
      id: d._id.toString(),
      sellerId,
      seller: {
        id: sellerId,
        name: seller?.name ?? 'Former member',
        city: seller?.city ?? null,
        avatarUrl: publicUrl(seller?.avatarKey),
        memberSince: seller?.createdAt ?? null,
        activeListings: activeById.get(sellerId) ?? 0,
      },
      categoryId: d.categoryId,
      ...categorySummary(tree, d.categoryId),
      listingType: d.listingType,
      title: d.title,
      description: d.description,
      price: d.price,
      currency: d.currency,
      city: d.city,
      district: d.district,
      attributes: d.attributes ?? {},
      status: d.status,
      availability: d.availability,
      photos: d.photos.map((p, position) => ({ id: p._id.toString(), url: publicUrl(p.key), position })),
      views: d.views,
      moderationNote: d.moderationNote,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      publishedAt: d.publishedAt,
      expiresAt: d.expiresAt ?? null,
      featuredUntil: d.featuredUntil && d.featuredUntil > new Date() ? d.featuredUntil : null,
    }
  })
}

export const toListingView = async (doc) => (await toListingViews([doc]))[0]
