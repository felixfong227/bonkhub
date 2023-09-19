import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import ytsr from 'ytsr';

const continuationSchema = z.array(
    z.union([
        z.string(),
        z.object({
            client: z.object({
                utcOffsetMinutes: z.number(),
                gl: z.string(),
                hl: z.string(),
                clientName: z.string(),
                clientVersion: z.string()
            }),
            user: z.object({}),
            request: z.object({})
        }),
        z.object({
            limit: z.null().optional(),
            safeSearch: z.boolean(),
            pages: z.number(),
            requestOptions: z.object({}).optional(),
            query: z.object({
                gl: z.string(),
                hl: z.string(),
                search_query: z.string()
            }),
            search: z.string()
        })
    ])
);

function isValidBase64(str: string) {
    try {
        return btoa(atob(str)) == str;
    } catch (err) {
        return false;
    }
}

function isBase64JSONLike(str: string, ctx: z.RefinementCtx) {
    try {
        const decoded = atob(str);
        JSON.parse(decoded);
        return true;
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'UNKNOW';
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['continuation'],
            fatal: true,
            message: `Decoded value is not a valid JSON object, whyyyyyyyyyyyyyyyyy????????? *BONK* \n ${errMsg}`,
        })
        return false;
    }
}

function parseStrToObject(str: string) {
    return JSON.parse(str);
}

function continuationValidationAndTransform(val: object, ctx: z.RefinementCtx) {
    const result = continuationSchema.safeParse(val);
    if (!result.success) {
        result.error.issues.forEach(issue => ctx.addIssue(issue));
        return false;
    }
    return result.data;
}

const querySchema = z.object({
    continuation: z.string()
        .refine(isValidBase64, 'input is not a valid Base64 string *BONK*')
        .superRefine(isBase64JSONLike)
        .transform(atob)
        .transform(parseStrToObject)
        .transform(continuationValidationAndTransform)
        .optional()
});

export const GET: APIRoute = async ({ request }) => {

    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);

    const queryParams = querySchema.safeParse(params);

    if (!queryParams.success) {
        return new Response(
            JSON.stringify({
                message: `Validation failed`,
                zodIssues: queryParams.error.issues,
            }),
            {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
    }

    try {

        const searchResults = () => ytsr('BONK meme', {
            limit: 10,
            pages: 1,
        });
        
        const continuationResult = () => queryParams.data.continuation ? ytsr.continueReq(queryParams.data.continuation) : null;
        
        let result = queryParams.data.continuation ? (await continuationResult()) : (await searchResults());

        return new Response(
            JSON.stringify({
                data: result?.items,
                metadata: {
                    continuation: result ? (
                        result.continuation !== null ? btoa(JSON.stringify(result.continuation)) : null
                     ) : null,
                }
            }),
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

    } catch (err) {
        return new Response(
            JSON.stringify({
                message: 'Internal server error',
                details: {
                    error: err instanceof Error ? err.message : 'Unknow error',
                }
            }),
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
    }

}